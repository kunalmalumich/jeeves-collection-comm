"use server";

import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { OpenAIApi, Configuration } from "openai-edge";
import { sendWhatsAppMessage } from "./sendWhatsAppMessage";

if (
  !env.NEXT_PUBLIC_SUPABASE_URL ||
  !env.SUPABASE_SERVICE_ROLE_KEY ||
  !env.OPENAI_API_KEY
) {
  throw new Error("Required environment variables are not set");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);
const configuration = new Configuration({
  apiKey: env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function getEnhancedMultilingualEmbedding(message: string) {
  const translationResponse = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a translation assistant. For the given text:
1. Detect if it's not in English
2. If not English, translate to English while preserving key terms
3. Return ONLY a JSON object in this format:
{
  "isEnglish": boolean,
  "englishVersion": "the English translation or original text",
  "originalText": "the original input text"
}
Do not include any other text in your response.`,
      },
      {
        role: "user",
        content: message,
      },
    ],
    temperature: 0,
  });

  const translationResult = await translationResponse.json();
  if (
    !translationResult.choices ||
    !translationResult.choices[0] ||
    !translationResult.choices[0].message
  ) {
    console.error("Invalid translation response:", translationResult);
    throw new Error("Failed to get valid translation response from OpenAI");
  }

  const parsedTranslation = JSON.parse(
    translationResult.choices[0].message.content,
  );
  // console.log("Parsed translation:", parsedTranslation);

  const textsToEmbed = [
    parsedTranslation.isEnglish
      ? parsedTranslation.originalText
      : parsedTranslation.englishVersion,
  ];

  const embeddingsResponse = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: textsToEmbed,
  });
  const embeddingResult = await embeddingsResponse.json();

  return {
    originalEmbedding: embeddingResult.data[0].embedding,
    englishEmbedding: embeddingResult.data[0].embedding,
    translationResult: parsedTranslation,
  };
}

function normalizePhoneNumber(phoneNumber: string) {
  if (phoneNumber.startsWith("+52")) {
    return phoneNumber.replace(/^\+521/, "+52"); // Convert +521XXXXXXXXXX to +52XXXXXXXXXX
  } else if (phoneNumber.startsWith("+55")) {
    return phoneNumber.replace(/^(\+55\d{2})9?(\d{8})$/, "$1$2"); // Convert +55XX9XXXXXXXX to +55XXXXXXXXXX
  }
  return phoneNumber; // Return unchanged if it's not +52 or +55
}

export async function sendMessage(
  _orgId: string,
  phoneNumber: string,
  message: string,
) {
  try {
    //console.log("Finding business_id for phone number:", phoneNumber);
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    const { data: statements, error: statementsError } = await supabase
      .from("credit_card_statements")
      .select("business_id")
      .or(
        `phone_number.eq.${normalizedPhoneNumber},` +
          (normalizedPhoneNumber.startsWith("+52")
            ? `phone_number.eq.+521${normalizedPhoneNumber.slice(3)}`
            : `phone_number.eq.+55${normalizedPhoneNumber.slice(3, 5)}9${normalizedPhoneNumber.slice(5)}`),
      )
      .limit(1);

    if (statementsError) {
      console.error("Error finding business_id:", statementsError);
      throw new Error("Failed to find business for phone number");
    }

    if (!statements || statements.length === 0) {
      console.error("No business found for phone number:", phoneNumber);
      throw new Error("No business found for this phone number");
    }

    const orgId = statements[0].business_id;
    //console.log("Found business_id:", orgId);

    const { error: insertError } = await supabase.from("chat_history").insert({
      business_id: orgId,
      phone_number: phoneNumber,
      message,
      is_from_business: false,
    });

    if (insertError) {
      console.error("Error inserting user message:", insertError);
      throw insertError;
    }

    const { originalEmbedding, englishEmbedding, translationResult } =
      await getEnhancedMultilingualEmbedding(message);

    /*const results = await supabase.rpc("match_documents", {
      query_embedding: englishEmbedding,
      match_threshold: 0.6,
      match_count: 500,
      p_business_id: orgId,
    });

    if (results.error) {
      console.error("Error matching documents:", results.error);
      throw results.error;
    }

    const allDocuments = [...(results.data || [])];

    const sortedDocuments = allDocuments
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 1000);

    const context = sortedDocuments.map((doc) => doc.content).join("\n\n");*/

    // Search for relevant content in the database

    const { data: documents, error: matchError } = await supabase.rpc(
      "match_documents",
      {
        query_embedding: englishEmbedding,
        match_threshold: 0.6,
        match_count: 1000,
        p_business_id: orgId,
      },
    );

    if (matchError) {
      console.error("Error matching documents:", matchError);
      throw matchError;
    }

    // Prepare context from matched documents
    const context = documents.map((doc: any) => doc.content).join("\n\n");

    console.log("Kunal - message : ");

    const chatResponse = await openai.createChatCompletion({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a friendly and helpful customer support representative for a credit card company.
    Follow these response guidelines:
    - Provide information strictly based on the given statement context
    - If information is not in the statement, politely explain that you don't have that specific data available
    - Maintain a professional yet warm tone throughout the conversation
    - Use WhatsApp-friendly formatting:
      - Bold for important points
      - Italics for emphasis
      - Bullet points (*) for lists
      - Numbers (1.) for step-by-step instructions
      - for quoting statement details
      - inline code for amounts or transaction names
    - Keep paragraphs short and easy to read on mobile devices
    - Avoid complex formatting not supported by WhatsApp
    - Summarize key information at the end of longer responses
    - IMPORTANT LANGUAGE INSTRUCTION: ${
      translationResult.isEnglish
        ? "The original query was in English, so respond in English"
        : `The original query was in another language (specifically the language of: "${translationResult.originalText}"). You MUST respond in that same language`
    }`,
        },
        {
          role: "user",
          content: `Hello! I'm looking at my credit card statement and have a question. Here's the relevant information:
    CONTEXT: ${context}
    Please help me answer the question - ${translationResult.isEnglish ? translationResult.originalText : translationResult.englishVersion}`,
        },
      ],
    });

    const chatResult = await chatResponse.json();
    const aiResponse = chatResult.choices[0].message.content;

    const { error: aiInsertError } = await supabase
      .from("chat_history")
      .insert({
        business_id: orgId,
        phone_number: phoneNumber,
        message: aiResponse,
        is_from_business: true,
      });

    if (aiInsertError) {
      console.error("Error inserting AI response:", aiInsertError);
      throw aiInsertError;
    }

    console.log("Message sent and processed successfully");
    return {
      message: aiResponse,
      whatsapp_status: "sent",
    };
  } catch (error) {
    console.error("Error processing message:", error);
    return {
      message:
        "I'm sorry, but there was an error processing your message. Please try again later.",
      whatsapp_status: "failed",
    };
  }
}

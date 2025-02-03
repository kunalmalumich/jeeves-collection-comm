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
  const parsedTranslation = JSON.parse(
    translationResult.choices[0].message.content,
  );

  const textsToEmbed = [parsedTranslation.originalText];
  if (!parsedTranslation.isEnglish) {
    textsToEmbed.push(parsedTranslation.englishVersion);
  }

  const embeddingsResponse = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: textsToEmbed,
  });
  const embeddingResult = await embeddingsResponse.json();

  return {
    originalEmbedding: embeddingResult.data[0].embedding,
    englishEmbedding: parsedTranslation.isEnglish
      ? embeddingResult.data[0].embedding
      : embeddingResult.data[1].embedding,
    translationResult: parsedTranslation,
  };
}

export async function sendMessage(
  _orgId: string,
  phoneNumber: string,
  message: string,
) {
  try {
    console.log("Finding business_id for phone number:", phoneNumber);

    const { data: statements, error: statementsError } = await supabase
      .from("credit_card_statements")
      .select("business_id")
      .eq("phone_number", phoneNumber)
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
    console.log("Found business_id:", orgId);

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

    const results = await supabase.rpc("match_documents", {
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

    const context = sortedDocuments.map((doc) => doc.content).join("\n\n");

    const chatResponse = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a friendly and helpful customer support representative for a credit card company. Follow these steps precisely:

1. Review the context and query carefully
2. If the query is not in English, ensure you fully understand it using this English translation for reference: "${translationResult.isEnglish ? message : translationResult.englishVersion}"
3. IMPORTANT LANGUAGE INSTRUCTION: ${translationResult.isEnglish ? 
    "The original query was in English, so respond in English" : 
    `The original query was in another language (specifically the language of: "${translationResult.originalText}"). You MUST respond in that same language, not in English`}

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
- Summarize key information at the end of longer responses`,
        },
        {
          role: "user",
          content: `Hello! I'm looking at my credit card statement and have a question. Here's the relevant information:
          CONTEXT:
        ${context}

ORIGINAL QUERY (${translationResult.isEnglish ? "English" : "Non-English"}):
${translationResult.originalText}

${
  !translationResult.isEnglish
    ? `ENGLISH TRANSLATION:
${translationResult.englishVersion}`
    : ""
}`,
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

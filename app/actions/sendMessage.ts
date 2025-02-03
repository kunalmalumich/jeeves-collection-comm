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

export async function sendMessage(
  _orgId: string,
  phoneNumber: string,
  message: string,
) {
  try {
    console.log("Finding business_id for phone number:", phoneNumber);

    // Find the actual orgId from credit_card_statements
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

    // Store user message in chat history
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

    // Create embedding for the user's message
    const embeddingResponse = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input: message,
    });

    const embeddingResult = await embeddingResponse.json();
    const embedding = embeddingResult.data[0].embedding;

    // Search for relevant content in the database
    const { data: documents, error: matchError } = await supabase.rpc(
      "match_documents",
      {
        query_embedding: embedding,
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

    // If no context is found, provide a default response
    /*if (!context) {
      const defaultResponse = "I'm sorry, but I couldn't find any relevant information in the credit card statements for your question. Could you please rephrase your question or ask about a different aspect of the statement?"
      const whatsappResult = await sendWhatsAppMessage(phoneNumber, defaultResponse)
      return { message: defaultResponse, whatsapp_status: whatsappResult.success ? 'sent' : 'failed' }
    }*/

    // Generate response using OpenAI
    const chatResponse = await openai.createChatCompletion({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a friendly and helpful customer support representative for a credit card company. Follow these steps precisely:

1. First, detect the language of the user's message
2. Then, understand the user's query (translating to English in your mind)
3. Finally, provide your response in the SAME LANGUAGE as the user's original message

Follow these guidelines:
Provide information strictly based on the given statement context.
If information is not in the statement, politely explain that you don't have that specific data available.
Maintain a professional yet warm tone throughout the conversation.
Use WhatsApp-friendly formatting:
Bold for important points
Italics for emphasis
Bullet points (*) for lists
Numbers (1.) for step-by-step instructions
for quoting statement details
inline code for amounts or transaction names
Keep paragraphs short and easy to read on mobile devices.
Avoid complex formatting not supported by WhatsApp.
Summarize key information at the end of longer responses.`,
        },
        {
          role: "user",
          content: `Hello! I'm looking at my credit card statement and have a question. Here's the relevant information:\n\n${context}\n\nCould you please help me with the following: ${message}`,
        },
      ],
    });

    const chatResult = await chatResponse.json();
    const aiResponse = chatResult.choices[0].message.content;

    // Store AI response in chat history
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

    // Send the AI response via WhatsApp
    // const whatsappResult = await sendWhatsAppMessage(phoneNumber, aiResponse)

    console.log("Message sent and processed successfully");
    return {
      message: aiResponse,
      whatsapp_status: "sent",
      // whatsapp_status: whatsappResult.success ? 'sent' : 'failed'
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

import { type NextRequest, NextResponse } from "next/server";
import { Twilio } from "twilio";
import { env } from "@/app/config/env";
import { sendMessage } from "@/app/actions/sendMessage";
import { sendWhatsAppMessage } from "@/app/actions/sendWhatsAppMessage";

const client = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export async function POST(req: NextRequest) {
  try {
    const { conversationSid, message } = await req.json();
    console.log("POST request received:", {
      conversationSid,
      messageAuthor: message.author,
      messageBody: message.body,
    });

    if (!conversationSid || !message) {
      console.error("Missing required parameters:", {
        conversationSid,
        message,
      });
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    await handleCustomerResponse(conversationSid, message);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function handleCustomerResponse(
  conversationSid: string,
  message: { author: string; body: string },
) {
  console.log("Starting handleCustomerResponse with:", {
    conversationSid,
    messageAuthor: message.author,
    messageBody: message.body,
  });

  try {
    const conversation = await client.conversations.v1
      .conversations(conversationSid)
      .fetch();
    const messages = await client.conversations.v1
      .conversations(conversationSid)
      .messages.list({ limit: 1 });

    // Remove 'whatsapp:' prefix from phone number
    const cleanPhoneNumber = message.author.replace("whatsapp:", "");
    console.log("Cleaned phone number:", cleanPhoneNumber);

    const messageResult = await sendMessage(
      "0",
      cleanPhoneNumber,
      message.body,
    );
    console.log("sendMessage result:", {
      status: messageResult?.whatsapp_status,
      hasMessage: !!messageResult?.message,
      messageLength: messageResult?.message?.length,
    });

    if (!messageResult || !messageResult.message) {
      console.error("No message content in messageResult:", messageResult);
      throw new Error("No message content received from AI");
    }

    // Add the message to the conversation
    await client.conversations.v1
      .conversations(conversationSid)
      .messages.create({
        author: "system",
        body: messageResult.message,
      });

    // Send via WhatsApp using sendWhatsAppMessage
    const whatsappResult = await sendWhatsAppMessage(
      cleanPhoneNumber,
      messageResult.message,
      conversationSid,
    );
    if (!whatsappResult.success) {
      throw new Error(
        `Failed to send WhatsApp message: ${whatsappResult.error}`,
      );
    }

    console.log("Successfully added and sent AI response:", {
      conversationMessage: true,
      whatsappMessage: whatsappResult.success,
      whatsappMessageId: whatsappResult.messageId,
    });
  } catch (error) {
    console.error("Error handling customer response:", error);
    throw error;
  }
}
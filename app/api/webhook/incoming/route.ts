import { type NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { env } from "@/app/config/env";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    message: "Webhook API is working correctly",
    timestamp: new Date().toISOString(),
    webhook_url: env.WEBHOOK_URL,
  });
}

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

async function handleIncomingMessage(
  conversationSid: string,
  from: string,
  message: string,
) {
  try {
    // Check for automated responses first
    if (
      message.toLowerCase().includes("avik") ||
      message.toLowerCase().includes("kunal")
    ) {
      let response =
        "Thank you for your message. Our team will respond shortly.";

      if (message.toLowerCase().includes("avik")) {
        response =
          "Your current balance information can be found on page 1 of your statement.";
      } else if (message.toLowerCase().includes("kunal")) {
        response =
          "Your payment due date is shown at the top of your statement.";
      }

      await client.conversations.v1
        .conversations(conversationSid)
        .messages.create({
          author: "system",
          body: response,
        });
    } else {
      if (!env.NEXT_PUBLIC_APP_URL) {
        throw new Error(
          "NEXT_PUBLIC_APP_URL is not set in environment variables",
        );
      }
      // For non-automated responses, call handle-customer-response
      const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, ""); // Remove any trailing slashes
      const url = `https://${baseUrl}/api/handle-customer-response`;
      console.log("Attempting to fetch from:", url);
      const response = await fetch(`${url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationSid,
          message: {
            author: from,
            body: message,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to handle customer response: ${response.statusText}`,
        );
      }
    }
  } catch (error) {
    console.error("Error handling message:", error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(String(error));
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!client) {
      throw new Error("Twilio client not initialized");
    }

    console.log("Webhook received");

    const formData = await request.formData();
    console.log("Parsed form data:", Object.fromEntries(formData.entries()));

    const From = formData.get("From") as string;
    const Body = formData.get("Body") as string;

    if (!From || !Body) {
      console.error("Missing required fields:", { From, Body });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Create new conversation for each incoming message
    console.log("Creating new conversation for:", From);
    const conversation = await client.conversations.v1.conversations.create({
      friendlyName: `Chat - ${From} - ${new Date().toISOString()}`,
    });

    // First, let's log the exact values we're working with
    const cleanNumber = From.replace("whatsapp:", "");
    if (!env.TWILIO_WHATSAPP_FROM) {
      throw new Error("TWILIO_WHATSAPP_FROM is not set");
    }
    const cleanProxyNumber = env.TWILIO_WHATSAPP_FROM.replace("whatsapp:", "");

    /*console.log("Debugging participant creation:", {
      conversationSid: conversation.sid,
      cleanNumber,
      cleanProxyNumber,
    });*/

    try {
      const participant = await (client.conversations.v1
        .conversations(conversation.sid)
        .participants.create({
          identity: cleanNumber,
          attributes: JSON.stringify({
            whatsAppNumber: cleanNumber,
          }),
          messagingBinding: {
            type: "whatsapp",
            address: From,
            proxyAddress: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
          },
        } as any) as any);

      // console.log("Successfully created participant:", participant);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Detailed error in participant creation:", {
          message: error.message,
          ...(error as any), // For additional Twilio error properties
        });
      } else {
        console.error("Unknown error in participant creation:", error);
      }
      throw error instanceof Error ? error : new Error(String(error));
    }

    /*console.log("Adding participant to conversation:", conversation.sid)
    await client.conversations.v1.conversations(conversation.sid).participants.create({
      "messagingBinding.address": `whatsapp:${From.replace('whatsapp:', '')}`,
      "messagingBinding.proxyAddress": `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
    })*/

    console.log("Handling incoming message");
    await handleIncomingMessage(conversation.sid, From, Body);

    return NextResponse.json({
      success: true,
      message: "Message processed successfully",
    });
  } catch (error) {
    console.error("Error handling incoming message:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

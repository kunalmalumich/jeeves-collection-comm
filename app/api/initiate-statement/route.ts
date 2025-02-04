import { type NextRequest, NextResponse } from "next/server";
import { Twilio } from "twilio";
import { env } from "@/app/config/env";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    // Check Twilio credentials
    const client = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    await client.api.accounts(env.TWILIO_ACCOUNT_SID || "").fetch();

    // Check Supabase connection
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL || "",
      env.SUPABASE_SERVICE_ROLE_KEY || "",
    );
    const { error } = await supabase
      .from("credit_card_statements")
      .select("count", { count: "exact", head: true });

    return NextResponse.json({
      status: "healthy",
      message: "API is working correctly",
      timestamp: new Date().toISOString(),
      environment: {
        hasTwilioSid: !!env.TWILIO_ACCOUNT_SID,
        hasTwilioToken: !!env.TWILIO_AUTH_TOKEN,
        hasWhatsappFrom: !!env.TWILIO_WHATSAPP_FROM,
        hasSupabaseUrl: !!env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
        hasTemplateContent: !!env.TWILIO_TEMPLATE_CONTENT_SID,
      },
      connections: {
        twilio: "connected",
        supabase: error ? "error" : "connected",
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

const client = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || "",
  env.SUPABASE_SERVICE_ROLE_KEY || "",
);

async function startStatementConversation(
  customerPhone: string,
  statementData: { month: string; amount: string; dueDate: string },
) {
  console.log("Starting new statement conversation for:", customerPhone);
  try {
    const formattedPhone = `whatsapp:${customerPhone}`;

    // Create new conversation
    const conversation = await client.conversations.v1.conversations.create({
      friendlyName: `Statement Discussion - ${customerPhone} - ${new Date().toISOString()}`,
    });

    // Add the customer as a participant
    const cleanNumber = customerPhone;
    const cleanProxyNumber = env.TWILIO_WHATSAPP_FROM;

    console.log("Attempting to create participant with:", {
      conversationSid: conversation.sid,
      cleanNumber,
      cleanProxyNumber,
    });

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
            address: formattedPhone,
            proxyAddress: `whatsapp:${cleanProxyNumber}`,
          },
        } as any) as any); // Type assertion to bypass TypeScript checks

      console.log("Successfully created participant:", {
        participantSid: participant.sid,
        identity: participant.identity,
        messagingBinding: participant.messagingBinding,
      });
    } catch (error) {
      console.error("Detailed error in participant creation:", {
        error: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        status: (error as any)?.status,
        details: (error as any)?.details,
        moreInfo: (error as any)?.moreInfo,
      });
      throw error;
    }

    // First send the template message
    console.log("Sending initial template message");
    if (!env.TWILIO_TEMPLATE_CONTENT_SID) {
      throw new Error(
        "TWILIO_TEMPLATE_CONTENT_SID environment variable is not set",
      );
    }

    // Get latest statement
    const latestStatement = await supabase
      .from("credit_card_statements")
      .select("file_path")
      .eq("phone_number", customerPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestStatement.error || !latestStatement.data) {
      throw new Error(`No statement found for phone number: ${customerPhone}`);
    }

    const pdfUrl = latestStatement.data.file_path.trim().replace(/\s+/g, "%20");

    // Log template variables
    console.log("Template variables:", {
      month: statementData.month,
      amount: statementData.amount,
      dueDate: statementData.dueDate,
      pdfUrl: pdfUrl,
    });

    /* await client.messages.create({
      from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
      to: formattedPhone,
      body: 'Your statement is ready', // Required default message
      contentSid: env.TWILIO_TEMPLATE_CONTENT_SID,
      contentVariables: JSON.stringify({
        1: statementData.month,
        2: statementData.amount,
        3: statementData.dueDate,
      })
    }) */

    // Send WhatsApp message with PDF
    await client.messages.create({
      from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
      to: formattedPhone,
      body: "We hope you're doing well. Please find your latest credit statement attached for your review. If you have any questions or need further assistance, feel free to reach out to us via email at soporte@tryjeeves.com. Thank you for choosing Jeeves.",
      // mediaUrl: [pdfUrl],
      contentSid: env.TWILIO_TEMPLATE_CONTENT_SID,
      contentVariables: JSON.stringify({
        "1": pdfUrl,
      }),
    });

    // Add welcome message to conversation
    await client.conversations.v1
      .conversations(conversation.sid)
      .messages.create({
        author: "system",
        body: "Welcome to your statement discussion. How can we help you today?",
      });

    return conversation.sid;
  } catch (error) {
    console.error("Error in statement conversation:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  console.log("Received POST request to /api/initiate-statement");
  console.log(
    "Request headers:",
    Object.fromEntries(request.headers.entries()),
  );
  console.log("Environment:", {
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
    TWILIO_WHATSAPP_FROM: !!env.TWILIO_WHATSAPP_FROM,
    TWILIO_ACCOUNT_SID: !!env.TWILIO_ACCOUNT_SID,
    SUPABASE_URL: !!env.NEXT_PUBLIC_SUPABASE_URL,
  });

  try {
    const body = await request.json();
    console.log("Request body:", body);

    const { customerPhone, statementData } = body;

    if (!customerPhone || !statementData) {
      console.error("Missing required fields:", {
        customerPhone: !!customerPhone,
        statementData: !!statementData,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    console.log("Initiating statement conversation for:", customerPhone);
    const conversationSid = await startStatementConversation(
      customerPhone,
      statementData,
    );
    console.log("Conversation initiated with SID:", conversationSid);

    const response = NextResponse.json({ success: true, conversationSid });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    return response;
  } catch (error) {
    console.error("Error initiating statement conversation:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      env: {
        hasTwilioSid: !!env.TWILIO_ACCOUNT_SID,
        hasTwilioToken: !!env.TWILIO_AUTH_TOKEN,
        hasWhatsappFrom: !!env.TWILIO_WHATSAPP_FROM,
        hasSupabaseUrl: !!env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        context: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

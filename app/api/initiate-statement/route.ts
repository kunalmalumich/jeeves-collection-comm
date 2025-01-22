import { type NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { env } from "@/app/config/env"

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

async function startStatementConversation(
  customerPhone: string,
  statementData: { month: string; amount: string; dueDate: string },
) {
  console.log("Starting statement conversation for:", customerPhone)
  try {
    // Check for existing conversations first
    const existingConversations = await client.conversations.v1.conversations.list({
      limit: 20
    });
    
    let conversation;
    const formattedPhone = `whatsapp:${customerPhone}`;
    
    // Try to find an existing conversation with this customer
    for (const conv of existingConversations) {
      const participants = await client.conversations.v1.conversations(conv.sid)
        .participants.list();
      
      const existingParticipant = participants.find(p => 
        p.messagingBinding?.address === formattedPhone
      );
      
      if (existingParticipant) {
        conversation = conv;
        break;
      }
    }
    
    // If no existing conversation found, create a new one
    if (!conversation) {
      conversation = await client.conversations.v1.conversations.create({
        friendlyName: `Statement Discussion - ${customerPhone}`,
      });
      
      // Add the customer as a participant only for new conversations
      await client.conversations.v1.conversations(conversation.sid)
        .participants.create({
          "messagingBinding.address": formattedPhone,
          "messagingBinding.proxyAddress": `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
        });
    }

    // Send the initial template message
    console.log("Sending initial template message")
    /*await client.messages.create({
      from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
      to: formattedPhone,
      templateName: "WhatsApp Tryout - Marketing (Autogenerated)",
      languageCode: "en",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: statementData.month },
            { type: "text", text: statementData.amount },
            { type: "text", text: statementData.dueDate },
          ],
        },
      ],
    })*/
      await client.messages.create({
        from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
        to: formattedPhone,
        body: `Your statement for ${statementData.month} is ready. Amount due: ${statementData.amount}. Due date: ${statementData.dueDate}`,
        // Remove templateName and components as they're not needed when using body
      })
      
    console.log("Initial template message sent")

    // Add a system message to the conversation
    console.log("Adding system message to conversation")
    await client.conversations.v1.conversations(conversation.sid).messages.create({
      author: "system",
      body: "Statement delivered. Customer service is ready to assist with any questions.",
    })
    console.log("System message added")

    // Set up webhook for handling responses
    console.log("Setting up webhook with URL:", env.WEBHOOK_URL)
    if (!env.WEBHOOK_URL) {
      throw new Error("WEBHOOK_URL environment variable is not set")
    }

    await client.conversations.v1.conversations(conversation.sid).webhooks.create({
      target: "webhook",
      "configuration.url": env.WEBHOOK_URL,
      "configuration.filters": ["onMessageAdded"],
      "configuration.method": "POST"
    })
    console.log("Webhook set up")

    return conversation.sid
  } catch (error) {
    console.error("Error in statement conversation:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  console.log("Received POST request to /api/initiate-statement")
  try {
    const body = await request.json()
    console.log("Request body:", body)

    const { customerPhone, statementData } = body

    if (!customerPhone || !statementData) {
      console.error("Missing required fields:", { customerPhone: !!customerPhone, statementData: !!statementData })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log("Initiating statement conversation for:", customerPhone)
    const conversationSid = await startStatementConversation(customerPhone, statementData)
    console.log("Conversation initiated with SID:", conversationSid)

    return NextResponse.json({ success: true, conversationSid })
  } catch (error) {
    console.error("Error initiating statement conversation:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}


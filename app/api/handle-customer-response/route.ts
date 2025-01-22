import { type NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { env } from "@/app/config/env"

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

async function handleCustomerResponse(conversationSid: string, message: { author: string; body: string }) {
  try {
    const conversation = await client.conversations.v1.conversations(conversationSid).fetch()
    const messages = await client.conversations.v1.conversations(conversationSid).messages.list({ limit: 1 })
    
    // Check if within 24-hour window
    if (messages.length > 0) {
      const lastMessageTime = new Date(messages[0].dateCreated)
      const now = new Date()
      const hoursSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60)

      if (hoursSinceLastMessage <= 24) {
        // Still within window, can reply normally
        await client.conversations.v1.conversations(conversationSid).messages.create({
          author: "system",
          body: "Thank you for your question. An agent will assist you shortly.",
        })
      } else {
        // Outside window, must use template
        await client.messages.create({
          from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
          to: `whatsapp:${message.author}`,
          templateName: "conversation_expired",
          languageCode: "en",
        })
      }
    } else {
      // No messages found, treat as new conversation
      await client.conversations.v1.conversations(conversationSid).messages.create({
        author: "system",
        body: "Thank you for your question. An agent will assist you shortly.",
      })
    }
  } catch (error) {
    console.error("Error handling customer response:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { conversationSid, message } = await request.json()

    if (!conversationSid || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await handleCustomerResponse(conversationSid, message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error handling customer response:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}


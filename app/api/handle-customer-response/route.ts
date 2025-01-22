import { type NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { env } from "@/app/config/env"
import { sendMessage } from "@/app/actions/sendMessage"

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

async function handleCustomerResponse(conversationSid: string, message: { author: string; body: string }) {
  try {
    const conversation = await client.conversations.v1.conversations(conversationSid).fetch()
    const messages = await client.conversations.v1.conversations(conversationSid).messages.list({ limit: 1 })
    
    // Remove 'whatsapp:' prefix from phone number
    const cleanPhoneNumber = message.author.replace('whatsapp:', '')
    
    // Check if within 24-hour window
    if (messages.length > 0) {
      const lastMessageTime = new Date(messages[0].dateCreated)
      const now = new Date()
      const hoursSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60)

      if (hoursSinceLastMessage <= 24) {
        // Call sendMessage with cleaned phone number
        const messageResult = await sendMessage('0', cleanPhoneNumber, message.body)
        
        if (!messageResult || messageResult.whatsapp_status === 'failed') {
          throw new Error('Failed to send message through AI')
        }

        // Add AI response to the conversation
        await client.conversations.v1.conversations(conversationSid).messages.create({
          author: "system",
          body: messageResult.message,
        })
      } else {
        // Outside window, must use template
        await client.messages.create({
          from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
          to: `whatsapp:${cleanPhoneNumber}`,
          templateName: "conversation_expired",
          languageCode: "en",
        })
      }
    } else {
      // For new conversations, also use sendMessage with cleaned phone number
      const messageResult = await sendMessage('0', cleanPhoneNumber, message.body)
      
      if (!messageResult || messageResult.whatsapp_status === 'failed') {
        throw new Error('Failed to send message through AI')
      }

      // Add AI response to the conversation
      await client.conversations.v1.conversations(conversationSid).messages.create({
        author: "system",
        body: messageResult.message,
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


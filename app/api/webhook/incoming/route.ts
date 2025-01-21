import { type NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { env } from "@/app/config/env"

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

async function handleIncomingMessage(conversationSid: string, from: string, message: string) {
  try {
    let response = "Thank you for your message. Our team will respond shortly."

    if (message.toLowerCase().includes("balance")) {
      response = "Your current balance information can be found on page 1 of your statement."
    } else if (message.toLowerCase().includes("due date")) {
      response = "Your payment due date is shown at the top of your statement."
    }

    await client.conversations.v1.conversations(conversationSid).messages.create({
      author: "system",
      body: response,
    })
  } catch (error) {
    console.error("Error handling message:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const From = body.get("From") as string
    const Body = body.get("Body") as string

    const conversations = await client.conversations.v1.conversations.list({ limit: 1 })

    let conversationSid

    if (conversations.length === 0) {
      const conversation = await client.conversations.v1.conversations.create({
        friendlyName: `User Initiated - ${From}`,
      })
      conversationSid = conversation.sid

      await client.conversations.v1.conversations(conversationSid).participants.create({
        "messagingBinding.address": From,
        "messagingBinding.proxyAddress": env.TWILIO_WHATSAPP_FROM,
      })
    } else {
      conversationSid = conversations[0].sid
    }

    await handleIncomingMessage(conversationSid, From, Body)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error handling incoming message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


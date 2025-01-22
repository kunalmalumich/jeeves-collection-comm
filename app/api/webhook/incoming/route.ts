import { type NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { env } from "@/app/config/env"

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

async function handleIncomingMessage(conversationSid: string, from: string, message: string) {
  try {
    // Check for automated responses first
    if (message.toLowerCase().includes("balance") || message.toLowerCase().includes("due date")) {
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
    } else {
      // For non-automated responses, call handle-customer-response
      const response = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/handle-customer-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationSid,
          message: {
            author: from,
            body: message
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to handle customer response: ${response.statusText}`)
      }
    }
  } catch (error) {
    console.error("Error handling message:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!client) {
      throw new Error('Twilio client not initialized')
    }

    console.log("Webhook received")
    
    // Parse form data first
    const formData = await request.formData()
    console.log("Parsed form data:", Object.fromEntries(formData.entries()))
    
    // Validate required fields
    const From = formData.get("From") as string
    const Body = formData.get("Body") as string
    
    if (!From || !Body) {
      console.error("Missing required fields:", { From, Body })
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    console.log("Testing Twilio client...")
    try {
      const conversations1 = await client.conversations.v1.conversations.list({ limit: 1 })
      console.log("Conversations fetch successful:", conversations1.length)
    } catch (twilioError) {
      console.error("Twilio client test failed:", twilioError)
      throw new Error(`Twilio client error: ${twilioError.message}`)
    }

    // Get conversations
    const conversations = await client.conversations.v1.conversations.list({ limit: 1 })
    
    let conversationSid
    if (conversations.length === 0) {
      console.log("Creating new conversation for:", From)
      const conversation = await client.conversations.v1.conversations.create({
        friendlyName: `User Initiated - ${From}`,
      })
      conversationSid = conversation.sid
      
      console.log("Adding participant to conversation:", conversationSid)
      await client.conversations.v1.conversations(conversationSid).participants.create({
        "messagingBinding.address": `whatsapp:${From}`,
        "messagingBinding.proxyAddress": `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
      })
    } else {
      conversationSid = conversations[0].sid
      console.log("Using existing conversation:", conversationSid)
    }

    console.log("Handling incoming message")
    await handleIncomingMessage(conversationSid, From, Body)
    
    return NextResponse.json({ 
      success: true,
      message: "Message processed successfully"
    })
  } catch (error) {
    console.error("Error handling incoming message:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}
import { type NextRequest, NextResponse } from "next/server"
import { Twilio } from "twilio";
import { env } from "@/app/config/env"

const client = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

async function startBusinessConversation(customerPhone: string) {
  try {
    const conversation = await client.conversations.v1.conversations.create({
      friendlyName: `Statement Discussion - ${customerPhone}`,
    })

    await client.conversations.v1.conversations(conversation.sid).participants.create({
      "messagingBinding.address": customerPhone,
      "messagingBinding.proxyAddress": env.TWILIO_WHATSAPP_FROM,
    })

    await client.conversations.v1.conversations(conversation.sid).messages.create({
      author: "system",
      body: "Your monthly statement is ready. Feel free to ask any questions!",
    })

    return conversation.sid
  } catch (error) {
    console.error("Error starting business conversation:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  console.log("API Route: Received POST request to /api/send-statement")
  console.log("API Route: Request headers:", Object.fromEntries(request.headers.entries()))
  try {
    console.log("API Route: Attempting to parse form data")
    const formData = await request.formData()
    console.log("API Route: Parsed form data:")
    for (const [key, value] of formData.entries()) {
      console.log(`${key}: ${value}`)
    }
    const orgId = formData.get("orgId") as string
    const customerPhone = formData.get("phoneNumber") as string

    if (!orgId || !customerPhone) {
      console.error("API Route: Missing required fields:", { orgId: !!orgId, customerPhone: !!customerPhone })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log("API Route: Received request to send statement:", {
      orgId,
      customerPhone,
    })

    console.log("API Route: Starting business conversation")
    const conversationSid = await startBusinessConversation(customerPhone)
    console.log("API Route: Business conversation started:", conversationSid)

    // Here you would typically trigger the process to generate and send the statement
    // For now, we'll just log that we would do this
    console.log(`API Route: Would generate and send statement for orgId: ${orgId}`)

    return NextResponse.json({ success: true, conversationSid })
  } catch (error) {
    console.error("API Route: Error in send-statement:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
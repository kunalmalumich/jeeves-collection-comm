import { type NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { env } from "@/app/config/env"
import { createClient } from '@supabase/supabase-js'

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || '',
  env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function startStatementConversation(
  customerPhone: string,
  statementData: { month: string; amount: string; dueDate: string },
) {
  console.log("Starting new statement conversation for:", customerPhone)
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
      cleanProxyNumber
    });

    try {
      const participant = await client.conversations.v1.conversations(conversation.sid)
        .participants
        .create({
          identity: cleanNumber,  // Using the clean number as identity
          attributes: JSON.stringify({
            whatsAppNumber: cleanNumber
          }),
          messagingBinding: {
            type: 'whatsapp',
            address: formattedPhone,
            proxyAddress: `whatsapp:${cleanProxyNumber}`
          }
        });

      console.log("Successfully created participant:", {
        participantSid: participant.sid,
        identity: participant.identity,
        messagingBinding: participant.messagingBinding
      });
    } catch (error) {
      console.error("Detailed error in participant creation:", {
        error: error.message,
        code: error.code,
        status: error.status,
        details: error.details,
        moreInfo: error.moreInfo
      });
      throw error;
    }

    // First send the template message
    console.log("Sending initial template message")
    if (!env.TWILIO_TEMPLATE_CONTENT_SID) {
      throw new Error("TWILIO_TEMPLATE_CONTENT_SID environment variable is not set")
    }

    const latestStatement = await supabase 
    .from('credit_card_statements')
    .select('public_url')
    .eq('phone_number', customerPhone)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (latestStatement.error || !latestStatement.data) {
    throw new Error(`No statement found for phone number: ${customerPhone}`)
  }
  
  const pdfUrl = latestStatement.data.public_url

    // Log the template variables for debugging
    console.log("Template variables:", {
      month: statementData.month,
      amount: statementData.amount,
      dueDate: statementData.dueDate
    })

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

    // Then send WhatsApp message with PDF
    await client.messages.create({
      from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
      to: formattedPhone,
      body: 'We hope you\'re doing well. Please find your latest credit statement attached for your review. If you have any questions or need further assistance, feel free to reach out to us via email at soporte@tryjeeves.com. Thank you for choosing Jeeves.',
      mediaUrl: [pdfUrl],
      contentSid: env.TWILIO_TEMPLATE_CONTENT_SID
    });

    // Finally add the welcome message
    await client.conversations.v1.conversations(conversation.sid)
      .messages.create({
        author: "system",
        body: "Welcome to your statement discussion. How can we help you today?",
      });

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


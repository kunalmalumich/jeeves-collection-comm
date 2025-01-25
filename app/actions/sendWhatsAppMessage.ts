'use server'

import { env } from '../config/env'
import twilio from "twilio"

const client = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

function validatePhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '')
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
}

export async function sendWhatsAppMessage(
  phoneNumber: string, 
  message: string, 
  conversationSid: string
) {
  try {
    const validatedNumber = validatePhoneNumber(phoneNumber)
    const from = `whatsapp:${env.TWILIO_WHATSAPP_FROM}`
    
    if (!env.TWILIO_WHATSAPP_FROM) {
      console.error('TWILIO_WHATSAPP_FROM is not set');
      return { success: false, error: 'WhatsApp sender number not configured' };
    }

    // Message chunking logic
    const MAX_LENGTH = 1500;
    const chunks = [];
    for (let i = 0; i < message.length; i += MAX_LENGTH) {
      chunks.push(message.slice(i, i + MAX_LENGTH));
    }
    
    let lastMessageSid = '';

    // Send each chunk through both conversation and WhatsApp
    for (let i = 0; i < chunks.length; i++) {
      const messageText = chunks.length > 1 ? 
        `(${i + 1}/${chunks.length}) ${chunks[i]}` : 
        chunks[i];

      // Add to conversation
      const conversationResult = await client.conversations.v1.conversations(conversationSid)
        .messages
        .create({
          author: env.TWILIO_WHATSAPP_FROM.replace('whatsapp:', ''),
          body: messageText
        });

      // Actually send WhatsApp message
      const whatsappResult = await client.messages.create({
        from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
        to: `whatsapp:${validatedNumber}`,
        body: messageText
      });

      lastMessageSid = whatsappResult.sid;

      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      success: true,
      messageId: lastMessageSid,
      conversationSid: conversationSid
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      messageLength: message.length,
      stack: error instanceof Error ? error.stack : undefined
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}


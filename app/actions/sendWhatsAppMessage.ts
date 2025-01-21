'use server'

import { env } from '../config/env'

function validatePhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '')
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
}

export async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  try {
    const validatedNumber = validatePhoneNumber(phoneNumber)
    const to = `whatsapp:${validatedNumber}`
    const from = `whatsapp:${env.TWILIO_WHATSAPP_FROM}`

    if (!env.TWILIO_WHATSAPP_FROM) {
      console.error('TWILIO_WHATSAPP_FROM is not set in the environment variables');
      return { success: false, error: 'WhatsApp sender number is not configured' };
    }

    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`
    
    const response = await fetch(twilioEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Body: message
      })
    })

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Twilio API error:', errorBody);
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.code === 63007) {
          errorMessage = "The WhatsApp sender number is not properly configured in Twilio. Please check your Twilio account settings.";
        } else {
          errorMessage += `, message: ${errorJson.message}`;
        }
      } catch (e) {
        console.error('Error parsing Twilio error response:', e);
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('WhatsApp message sent:', result.sid)
    return { success: true, messageId: result.sid }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}


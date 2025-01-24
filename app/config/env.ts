export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  TWILIO_TEMPLATE_CONTENT_SID: process.env.TWILIO_TEMPLATE_CONTENT_SID,
}

// Only validate non-public env vars on the server side
if (typeof window === 'undefined') {
  const requiredEnvVars = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "WEBHOOK_URL",
    "TWILIO_TEMPLATE_CONTENT_SID"
  ]

  requiredEnvVars.forEach((varName) => {
    if (!env[varName as keyof typeof env]) {
      throw new Error(`${varName} is not set in the environment variables`)
    }
  })
}

// Always validate public env vars
const requiredPublicEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_APP_URL"
]

requiredPublicEnvVars.forEach((varName) => {
  if (!env[varName as keyof typeof env]) {
    throw new Error(`${varName} is not set in the environment variables`)
  }
})

// Log the Supabase URL and APP_URL for debugging (remove in production)
console.log("Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL)
console.log("APP_URL:", env.NEXT_PUBLIC_APP_URL)


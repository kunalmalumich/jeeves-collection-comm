
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  watchOptions: {
    followSymlinks: false,
    ignored: ['**/node_modules', '**/.git'],
    persistent: true,
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    WEBHOOK_URL: process.env.WEBHOOK_URL,
  },
  // Use server configuration instead of hostname and port
  server: process.env.REPL_SLUG ? {
    host: '0.0.0.0',
    port: 3000
  } : {}
}

module.exports = nextConfig

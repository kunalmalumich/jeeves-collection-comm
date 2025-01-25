
const nextConfig = {
  experimental: {
    serverActions: true,
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
    TWILIO_TEMPLATE_CONTENT_SID: process.env.TWILIO_TEMPLATE_CONTENT_SID || '',
  },
  output: 'standalone',
  webpack: (config) => {
    return config;
  },
  webpackDevMiddleware: (config) => {
    return config;
  },
  // Required for Replit - configure server to listen on 0.0.0.0
  server: {
    hostname: '0.0.0.0',
    port: 3000
  }
}

module.exports = nextConfig

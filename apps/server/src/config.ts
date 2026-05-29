import dotenv from 'dotenv'
dotenv.config()

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? requireEnv('JWT_SECRET') : 'laiw-dev-secret'),
  },

  database: {
    url: process.env.DATABASE_URL || (process.env.NODE_ENV === 'production' ? requireEnv('DATABASE_URL') : 'postgresql://laiw:laiw@localhost:5432/laiw'),
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  session: {
    secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? requireEnv('SESSION_SECRET') : 'laiw-dev-session'),
    cookieName: process.env.AUTH_COOKIE_NAME || 'laiw.session',
  },

  markitdown: {
    baseUrl: process.env.MARKITDOWN_AGENT_BASE_URL || 'http://localhost:3013',
  },

  billing: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    enabled: !!process.env.STRIPE_SECRET_KEY,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000'),
  },
}

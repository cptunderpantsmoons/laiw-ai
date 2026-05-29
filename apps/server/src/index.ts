import 'reflect-metadata'
import 'dotenv/config'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import authRoutes from './routes/auth.js'
import matterRoutes from './routes/matters.js'
import contractRoutes from './routes/contracts.js'
import spendRoutes from './routes/spend.js'
import kbRoutes from './routes/kb.js'
import intakeRoutes from './routes/intake.js'
import insightsRoutes from './routes/insights.js'
import documentRoutes from './routes/documents.js'
import aiChatRoutes from './routes/ai-chat.js'
import aiKbRoutes from './routes/ai-kb.js'
import aiReviewRoutes from './routes/ai-review.js'
import aiPersonaRoutes from './routes/ai-personas.js'
import aiWorkflowRoutes from './routes/ai-workflows.js'
import aiDocumentRoutes from './routes/ai-documents.js'
import billingRoutes from './routes/billing.js'
import contactRoutes from './routes/contacts.js'
import auditRoutes from './routes/audit.js'
import matterTypeRoutes from './routes/matter-types.js'
import taskRoutes from './routes/tasks.js'
import customFieldRoutes from './routes/custom-fields.js'
import matterAutoRoutes from './routes/matter-auto.js'
import { config } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

// Security middleware
app.use(helmet())

app.use(cors({
  origin: config.cors.origin || 'http://localhost:3000',
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
})
app.use('/api/login', authLimiter)
app.use('/api/register', authLimiter)

// Health check with DB connectivity
app.get('/api/health', async (_req, res) => {
  try {
    const { prisma } = await import('./models/prisma.js')
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'degraded', db: 'disconnected', timestamp: new Date().toISOString() })
  }
})

// API routes
app.use('/api', authRoutes)
app.use('/api', matterRoutes)
app.use('/api', contractRoutes)
app.use('/api', spendRoutes)
app.use('/api', kbRoutes)
app.use('/api', intakeRoutes)
app.use('/api', insightsRoutes)
app.use('/api', documentRoutes)
app.use('/api', aiChatRoutes)
app.use('/api', aiKbRoutes)
app.use('/api', aiReviewRoutes)
app.use('/api', aiPersonaRoutes)
app.use('/api', aiWorkflowRoutes)
app.use('/api', aiDocumentRoutes)
app.use('/api', billingRoutes)
app.use('/api', contactRoutes)
app.use('/api', auditRoutes)
app.use('/api', matterTypeRoutes)
app.use('/api', taskRoutes)
app.use('/api', customFieldRoutes)
app.use('/api', matterAutoRoutes)

// Serve built client in production
if (config.nodeEnv === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  })
}

// Error handler with structured logging
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const timestamp = new Date().toISOString()
  console.error(JSON.stringify({
    timestamp,
    level: 'error',
    message: err.message,
    stack: err.stack,
    name: err.name,
  }))
  res.status(500).json({ error: config.nodeEnv === 'production' ? 'internal server error' : err.message })
})

// Graceful shutdown
const server = app.listen(config.port, () => {
  console.log(`Laiw server listening on port ${config.port} [${config.nodeEnv}]`)
})

function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`)
  server.close(async () => {
    try {
      const { prisma } = await import('./models/prisma.js')
      await prisma.$disconnect()
      console.log('Prisma disconnected.')
      process.exit(0)
    } catch (err) {
      console.error('Error during shutdown:', err)
      process.exit(1)
    }
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

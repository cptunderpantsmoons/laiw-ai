import { Router } from 'express'
import { prisma } from '../models/prisma.js'
import { registerUser, verifyLogin } from '../models/user.js'
import { signToken } from '../auth/jwt.js'

const router = Router()

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' })
    }
    const user = await registerUser(email, password, firstName, lastName)
    const token = await signToken({
      userId: user.id,
      email: user.email,
      orgId: user.organizationId,
      role: user.role,
    })
    res.status(201).json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, token })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await verifyLogin(email, password)
    if (!user) return res.status(401).json({ error: 'invalid credentials' })
    const token = await signToken({
      userId: user.id,
      email: user.email,
      orgId: user.organizationId,
      role: user.role,
    })
    res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, token })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router

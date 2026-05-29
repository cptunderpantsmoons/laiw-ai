import { Request, Response, NextFunction } from 'express'
import { verifyToken, TokenPayload } from './jwt.js'

export interface AuthRequest extends Request {
  userId?: string
  email?: string
  orgId?: string | null
  role?: string
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const token = auth.replace('Bearer ', '')
  try {
    const payload = await verifyToken(token)
    req.userId = payload.userId
    req.email = payload.email
    req.orgId = payload.orgId ?? null
    req.role = payload.role
    next()
  } catch {
    res.status(401).json({ error: 'invalid token' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
    if (roles.length && !roles.includes(req.role || '')) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  }
}

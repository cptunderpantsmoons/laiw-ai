import { jwtVerify, SignJWT, JWTPayload } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'laiw-dev-secret-change-in-production'
)

export interface TokenPayload extends JWTPayload {
  userId: string
  email: string
  orgId?: string | null
  role?: string
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .setAudience('laiw-api')
    .setIssuer('laiw-server')
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, SECRET, {
    clockTolerance: 60,
    audience: 'laiw-api',
    issuer: 'laiw-server',
  })
  if (!payload.userId || !payload.email) {
    throw new Error('invalid token payload')
  }
  return payload as TokenPayload
}

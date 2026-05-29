import { prisma } from './prisma'
import { hashPassword, verifyPassword } from '../auth/password'

export async function registerUser(email: string, password: string, firstName?: string, lastName?: string) {
  const passwordHash = await hashPassword(password)
  return prisma.user.create({
    data: { email, passwordHash, firstName, lastName },
  })
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

export async function verifyLogin(email: string, password: string) {
  const user = await findUserByEmail(email)
  if (!user) return null
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null
  return user
}

export async function createOrganization(name: string, userId: string) {
  return prisma.organization.create({
    data: {
      name,
      users: { create: { id: userId, email: '', passwordHash: '' } },
    },
  })
}

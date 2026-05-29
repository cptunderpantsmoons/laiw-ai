import { prisma } from './prisma'

export async function listChats(matterId: string) {
  return prisma.chat.findMany({
    where: { matterId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createChat(matterId: string, role: string, content: string) {
  return prisma.chat.create({
    data: {
      matterId,
      role,
      content,
    },
  })
}

export async function getChatMessage(chatId: string) {
  return prisma.chat.findUnique({
    where: { id: chatId },
  })
}

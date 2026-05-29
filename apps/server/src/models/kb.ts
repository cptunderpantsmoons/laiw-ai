import { prisma } from './prisma'

export async function createEntry(orgId: string, title: string, body: string, tags: string[] = []) {
  return prisma.kBEntry.create({
    data: {
      orgId,
      title,
      body,
      tags,
    },
  })
}

export async function listEntries(orgId: string, search?: string, tags?: string[]) {
  const where: { orgId: string; title?: { contains: string } } = {
    orgId,
  }

  if (search) (where as any).title = { contains: search }
  if (tags && tags.length > 0) (where as any).tags = tags

  return prisma.kBEntry.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getEntry(entryId: string) {
  return prisma.kBEntry.findUnique({
    where: { id: entryId },
  })
}

export async function updateEntry(entryId: string, updates: {
  title?: string
  body?: string
  tags?: string[]
}) {
  return prisma.kBEntry.update({
    where: { id: entryId },
    data: updates,
  })
}

export async function deleteEntry(entryId: string) {
  return prisma.kBEntry.delete({
    where: { id: entryId },
  })
}

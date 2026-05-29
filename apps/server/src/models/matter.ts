import { prisma } from './prisma'
import type { MatterStatus, TaskStatus } from '@prisma/client'

export async function createMatter(name: string, description: string | null, orgId: string, userId: string) {
  const matter = await prisma.matter.create({
    data: { name, description, orgId },
  })
  await prisma.matterMember.create({
    data: { matterId: matter.id, userId, role: 'owner' },
  })
  return matter
}

export async function listMatters(orgId: string, userId: string, status?: string) {
  return prisma.matter.findMany({
    where: {
      orgId,
      status: status as MatterStatus | undefined,
      members: { some: { userId } },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { contracts: true, documents: true, spendTransactions: true } },
    },
  })
}

export async function getMatter(matterId: string, userId: string) {
  return prisma.matter.findUnique({
    where: { id: matterId },
    include: {
      contracts: { orderBy: { updatedAt: 'desc' } },
      documents: { orderBy: { createdAt: 'desc' } },
      spendTransactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      tasks: { where: { status: { not: 'DONE' } }, orderBy: { priority: 'asc' } },
      members: { include: { user: true } },
    },
  })
}

export async function updateMatter(matterId: string, name: string, description: string | null) {
  return prisma.matter.update({
    where: { id: matterId },
    data: { name, description },
  })
}

export async function archiveMatter(matterId: string) {
  return prisma.matter.update({
    where: { id: matterId },
    data: { status: 'CLOSED' },
  })
}

export async function createTask(matterId: string | null, title: string, description: string | null, priority: string, assigneeId: string | null) {
  return prisma.task.create({
    data: {
      matterId,
      title,
      description,
      priority: priority as any,
      assigneeId,
    },
  })
}

export async function listTasks(matterId: string | null, status?: string) {
  return prisma.task.findMany({
    where: {
      matterId,
      status: status as TaskStatus | undefined,
    },
    orderBy: { priority: 'asc' },
    include: { assignee: true },
  })
}

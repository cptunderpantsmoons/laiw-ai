import { prisma } from './prisma'

export async function createContract(matterId: string, title: string, counterparty: string | null, contractType: string | null, startDate: string | null, endDate: string | null) {
  return prisma.contract.create({
    data: {
      matterId,
      title,
      counterparty,
      contractType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    },
  })
}

export async function listContracts(matterId: string, status?: string) {
  return prisma.contract.findMany({
    where: {
      matterId,
      status: (status as any) || undefined,
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { versions: true, redlines: true } },
    },
  })
}

export async function getContract(contractId: string) {
  return prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      versions: { orderBy: { number: 'desc' } },
      redlines: { include: { version: true } },
      documents: true,
    },
  })
}

export async function updateContract(contractId: string, updates: {
  title?: string
  counterparty?: string | null
  contractType?: string | null
  status?: string | undefined
  startDate?: string | null
  endDate?: string | null
  autoRenew?: boolean
  contractValue?: number
  currency?: string
}) {
  return prisma.contract.update({
    where: { id: contractId },
    data: updates as any,
  })
}

export async function createVersion(contractId: string, number: number, content: string | null, docxKey: string | null, changes: string | null) {
  // Update the contract's currentVersionId if this is the latest version
  const version = await prisma.contractVersion.create({
    data: {
      contractId,
      number,
      content,
      docxKey,
      changes,
    },
  })

  await prisma.contract.update({
    where: { id: contractId },
    data: { currentVersionId: version.id },
  })

  return version
}

export async function listVersions(contractId: string) {
  return prisma.contractVersion.findMany({
    where: { contractId },
    orderBy: { number: 'asc' },
  })
}

export async function createRedline(versionId: string, clauseIndex: number, proposed: string, original: string, action: string) {
  // Get the contractId from the version
  const version = await prisma.contractVersion.findUnique({
    where: { id: versionId },
    select: { contractId: true },
  })

  if (!version) throw new Error('Version not found')

  return prisma.contractRedline.create({
    data: {
      versionId,
      contractId: version.contractId,
      clauseIndex,
      proposed,
      original,
      action: action as any,
    },
  })
}

export async function listRedlines(versionId: string) {
  return prisma.contractRedline.findMany({
    where: { versionId },
    orderBy: { clauseIndex: 'asc' },
  })
}

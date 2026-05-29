import { prisma } from './prisma'
import { Decimal } from '@prisma/client/runtime/library'

export async function createBudget(matterId: string, totalAmount: number, currency: string = 'USD') {
  return prisma.spendBudget.create({
    data: {
      matterId,
      totalAmount: new Decimal(totalAmount),
      currency,
    },
  })
}

export async function listBudgets(matterId?: string) {
  const where: { matterId?: string } = {}
  if (matterId) where.matterId = matterId

  return prisma.spendBudget.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateBudget(budgetId: string, updates: {
  totalAmount?: number
  currency?: string
}) {
  return prisma.spendBudget.update({
    where: { id: budgetId },
    data: updates,
  })
}

export async function createTransaction(matterId: string, type: string, amount: number, vendorName?: string | null, invoiceRef?: string | null, notes?: string | null) {
  return prisma.spendTransaction.create({
    data: {
      matterId,
      type: type as any,
      amount: new Decimal(amount),
      vendorName: vendorName || null,
      invoiceRef: invoiceRef || null,
      notes: notes || null,
    },
  })
}

export async function listTransactions(matterId?: string, status?: string) {
  const where: Record<string, unknown> = {}
  if (matterId) where.matterId = matterId
  if (status) where.status = status

  return prisma.spendTransaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      matter: { select: { id: true, name: true } },
    },
  })
}

export async function updateTransactionStatus(transactionId: string, status: string) {
  return prisma.spendTransaction.update({
    where: { id: transactionId },
    data: { status: status as any },
  })
}

export async function getMatterSpendSummary(matterId: string) {
  const budgets = await prisma.spendBudget.findMany({
    where: { matterId },
    select: { totalAmount: true },
  })

  const transactions = await prisma.spendTransaction.findMany({
    where: { matterId },
    select: { amount: true, type: true, status: true },
  })

  const totalBudget = budgets.reduce((sum: number, b: { totalAmount: Decimal }) => sum + b.totalAmount.toNumber(), 0)
  const spent = transactions.reduce((sum: number, t: { amount: Decimal }) => sum + t.amount.toNumber(), 0)
  const remaining = totalBudget - spent

  const transactionsByType: Record<string, { total: number; count: number }> = {}
  for (const t of transactions) {
    if (!transactionsByType[t.type]) {
      transactionsByType[t.type] = { total: 0, count: 0 }
    }
    transactionsByType[t.type].total += t.amount.toNumber()
    transactionsByType[t.type].count += 1
  }

  return { totalBudget, spent, remaining, transactionsByType }
}

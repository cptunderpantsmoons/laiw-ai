import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import { prisma } from '../models/prisma'
import { Decimal } from '@prisma/client/runtime/library'

const router = Router()


async function getOrgId(req: AuthRequest): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { organizationId: true },
  })
  return user?.organizationId || null
}

// ── Helper: month string from date ─────────────────────────

function monthKey(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// ── Dashboard Insight ─────────────────────────────────────

// GET /api/insights/dashboard
router.get('/insights/dashboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return res.status(400).json({ error: 'no organization' })

    const [
      totalMatters,
      activeMatters,
      totalContracts,
      activeContracts,
      totalMatterIds,
      totalSpendResult,
      recentChats,
      recentTransactions,
      contractStatusCount,
      matterAgingResult,
      intakeCounts,
    ] = await Promise.all([
      prisma.matter.count({ where: { orgId } }),
      prisma.matter.count({ where: { orgId, status: { not: 'CLOSED' } } }),
      prisma.contract.count({ where: { matter: { orgId } } }),
      prisma.contract.count({
        where: { matter: { orgId }, status: { notIn: ['EXPIRED', 'TERMINATED'] as any } },
      }),
      prisma.matter.findMany({ where: { orgId }, select: { id: true } }),
      // Fix: actually sum spendTransaction.amount
      prisma.spendTransaction.aggregate({
        where: { matter: { orgId } },
        _sum: { amount: true },
        _count: { amount: true },
      }),
      prisma.chat.findMany({
        where: { matter: { orgId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { matter: { select: { name: true } } },
      }),
      prisma.spendTransaction.findMany({
        where: { matter: { orgId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { matter: { select: { name: true } } },
      }),
      prisma.contract.groupBy({
        by: ['status'],
        where: { matter: { orgId } },
        _count: true,
      }),
      // Matters aging — group by createdAt relative to now
      prisma.matter.findMany({
        where: { orgId },
        select: { createdAt: true },
      }),
      // Intake counts
      prisma.intakeSubmission.groupBy({
        by: ['status'],
        where: { form: { org: { id: orgId } } },
        _count: true,
      }),
    ])

    const matterIds = totalMatterIds.map((m: { id: string }) => m.id)

    // Fix: calculate totalSpend from sum of spendTransaction.amount
    const totalSpend = (totalSpendResult._sum.amount instanceof Decimal
      ? totalSpendResult._sum.amount.toNumber()
      : Number(totalSpendResult._sum.amount || 0))

    // Active tasks (not DONE)
    const pendingTasks = await prisma.task.count({
      where: { matter: { orgId }, status: { not: 'DONE' } },
    })

    // Contract status breakdown
    const contractStatus = contractStatusCount.map((c: any) => ({
      status: c.status,
      count: c._count,
    }))

    // Matter aging — 4 brackets based on creation date
    const now = new Date()
    const matterAging = [
      { bracket: '0-30 days', min: 0, max: 30 * 86400000, count: 0 },
      { bracket: '31-90 days', min: 30 * 86400000, max: 90 * 86400000, count: 0 },
      { bracket: '91-180 days', min: 90 * 86400000, max: 180 * 86400000, count: 0 },
      { bracket: '181+ days', min: 180 * 86400000, max: Infinity, count: 0 },
    ]
    matterAgingResult.forEach((m: { createdAt: Date }) => {
      const age = now.getTime() - m.createdAt.getTime()
      for (const bracket of matterAging) {
        if (age >= bracket.min && age < bracket.max) {
          bracket.count++
          break
        }
      }
    })

    // Intake metrics
    const intakeMetrics: Record<string, number> = {}
    for (const c of intakeCounts) {
      intakeMetrics[c.status] = c._count
    }

    const recentActivity: Record<string, unknown>[] = [
      ...recentChats.map((c: { content: string; createdAt: Date; matter: { name: string } }) => ({
        type: 'chat',
        message: c.content.slice(0, 100),
        matter: c.matter.name,
        date: c.createdAt.toISOString(),
      })),
      ...recentTransactions.map((t: { notes: string | null; amount: Decimal; createdAt: Date; matter: { name: string }; vendorName: string | null }) => ({
        type: 'spend',
        message: t.vendorName || t.notes || 'Transaction',
        amount: Number(t.amount),
        matter: t.matter.name,
        date: t.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20)

    // Spend trends (last 12 months) — computed via aggregation
    const spendTrends: { month: string; amount: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)

      const monthlyResult = await prisma.spendTransaction.aggregate({
        where: {
          matter: { orgId },
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      })
      spendTrends.push({
        month: monthKey(startOfMonth),
        amount: monthlyResult._sum.amount instanceof Decimal
          ? monthlyResult._sum.amount.toNumber()
          : Number(monthlyResult._sum.amount || 0),
      })
    }

    res.json({
      totalMatters,
      activeMatters,
      totalContracts,
      activeContracts,
      totalSpend,
      pendingTasks,
      recentActivity,
      // Enhanced data
      spendTrends,
      contractStatus,
      matterAging,
      intakeMetrics,
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ── Spend Trends ──────────────────────────────────────────

// GET /api/insights/spend-trends?period=monthly
router.get('/insights/spend-trends', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return res.status(400).json({ error: 'no organization' })

    const period = (req.query.period as string) || 'monthly'

    if (period === 'monthly') {
      const spendTrends: { month: string; amount: number }[] = []
      const now = new Date()
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)

        const monthlyResult = await prisma.spendTransaction.aggregate({
          where: {
            matter: { orgId },
            createdAt: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        })
        spendTrends.push({
          month: monthKey(startOfMonth),
          amount: monthlyResult._sum.amount instanceof Decimal
            ? monthlyResult._sum.amount.toNumber()
            : Number(monthlyResult._sum.amount || 0),
        })
      }
      return res.json(spendTrends)
    }

    res.json([])
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ── Contract Status ───────────────────────────────────────

// GET /api/insights/contract-status
router.get('/insights/contract-status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return res.status(400).json({ error: 'no organization' })

    const contractStatusCount = await prisma.contract.groupBy({
      by: ['status'],
      where: { matter: { orgId } },
      _count: true,
    })

    res.json(contractStatusCount.map((c: any) => ({ status: c.status, count: c._count })))
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ── Matter Aging ──────────────────────────────────────────

// GET /api/insights/matter-aging?orgId=X
router.get('/insights/matter-aging', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return res.status(400).json({ error: 'no organization' })

    const now = new Date()
    const matterAging = await prisma.matter.findMany({
      where: { orgId },
      select: { createdAt: true },
    })

    const result = [
      { bracket: '0-30 days', count: 0 },
      { bracket: '31-90 days', count: 0 },
      { bracket: '91-180 days', count: 0 },
      { bracket: '181+ days', count: 0 },
    ]

    const brackets = [
      { min: 0, max: 30 * 86400000 },
      { min: 30 * 86400000, max: 90 * 86400000 },
      { min: 90 * 86400000, max: 180 * 86400000 },
      { min: 180 * 86400000, max: Infinity },
    ]

    matterAging.forEach((m: { createdAt: Date }) => {
      const age = now.getTime() - m.createdAt.getTime()
      for (let i = 0; i < brackets.length; i++) {
        if (age >= brackets[i].min && age < brackets[i].max) {
          result[i].count++
          break
        }
      }
    })

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ── Intake Metrics ────────────────────────────────────────

// GET /api/insights/intake
router.get('/insights/intake', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return res.status(400).json({ error: 'no organization' })

    // Total submissions
    const totalCount = await prisma.intakeSubmission.count({
      where: { form: { org: { id: orgId } } },
    })

    // Count by status
    const statusCounts = await prisma.intakeSubmission.groupBy({
      by: ['status'],
      where: { form: { org: { id: orgId } } },
      _count: true,
    })

    // Build status lookup
    const statusMap: Record<string, number> = {}
    for (const c of statusCounts) {
      statusMap[c.status] = c._count
    }

    const intakeMetrics = {
      totalSubmissions: totalCount,
      pendingCount: statusMap['RECEIVED'] || statusMap['PENDING'] || 0,
      triagedCount: statusMap['TRIAGED'] || statusMap['IN_PROGRESS'] || 0,
      convertedCount: statusMap['RESOLVED'] || statusMap['CONVERTED'] || 0,
      rejectedCount: statusMap['REJECTED'] || 0,
    }

    res.json(intakeMetrics)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router

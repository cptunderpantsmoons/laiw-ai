#!/usr/bin/env -S npx tsx
// Seed script for Laiw demo data

import { prisma } from '../models/prisma'
import { hashPassword } from '../auth/password'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const ORG_NAME = 'Acme Legal Ops'
const DEMO_PASSWORD = 'demo123'

interface SeedUser {
  email: string
  firstName: string
  lastName: string
  role: string
}

const USERS: SeedUser[] = [
  { email: 'admin@acme.law', firstName: 'Admin', lastName: 'User', role: 'ADMIN' },
  { email: 'lawyer@acme.law', firstName: 'Jane', lastName: 'Lawyer', role: 'ATTORNEY' },
  { email: 'paralegal@acme.law', firstName: 'Bob', lastName: 'Paralegal', role: 'PARALEGAL' },
]

interface MatterDef {
  name: string
  description: string
  status: string
  matterType: string
}

const MATTERS: MatterDef[] = [
  { name: 'Merger - TechCorp', description: 'Merger acquisition of TechCorp by Acme Holdings', status: 'OPEN', matterType: 'corporate' },
  { name: 'Patent Litigation - Infringement', description: 'Patent infringement litigation against competitor', status: 'IN_PROGRESS', matterType: 'litigation' },
  { name: 'Employment Compliance Review', description: 'Full review of employment policies and compliance', status: 'OPEN', matterType: 'compliance' },
  { name: 'IP Portfolio Restructuring', description: 'Restructuring and optimization of IP portfolio', status: 'ON_HOLD', matterType: 'ip' },
]

interface ContractDef {
  title: string
  counterparty: string | null
  contractType: string | null
  status: string
  contractValue?: number
  currency?: string
  startDate?: string
  endDate?: string
  autoRenew?: boolean
}

const CONTRACTS: (ContractDef & { matterIndex: number })[] = [
  { matterIndex: 0, title: 'NDA with TechCorp', counterparty: 'TechCorp', contractType: 'NDA', status: 'DRAFT' },
  { matterIndex: 0, title: 'MSA with TechCorp', counterparty: 'TechCorp', contractType: 'MSA', status: 'EXECUTED', contractValue: 50000000, currency: 'USD', startDate: '2026-01-01', endDate: '2027-12-31', autoRenew: true },
  { matterIndex: 1, title: 'Patent Licensing Agreement', counterparty: 'Licensing Corp', contractType: 'Licensing', status: 'UNDER_REVIEW', startDate: '2026-03-01', endDate: '2029-02-28' },
  { matterIndex: 1, title: 'Settlement Agreement', counterparty: 'Defendant Inc', contractType: 'Settlement', status: 'DRAFT' },
  { matterIndex: 2, title: 'Employment Policy Update', counterparty: null, contractType: 'Policy', status: 'DRAFT' },
  { matterIndex: 2, title: 'Benefits Vendor MSA', counterparty: 'BenefitsCo', contractType: 'MSA', status: 'APPROVED', startDate: '2026-06-01', endDate: '2028-05-31' },
  { matterIndex: 3, title: 'Patent Assignment Agreement', counterparty: 'PatentHolder LLC', contractType: 'Assignment', status: 'DRAFT' },
  { matterIndex: 3, title: 'Cross-License Agreement', counterparty: 'CrossLicensor', contractType: 'License', status: 'EXECUTED', contractValue: 25000000, currency: 'USD', startDate: '2026-02-01', endDate: '2031-01-31', autoRenew: false },
]

interface SpendTransactionDef {
  matterIndex: number
  type: string
  vendorName: string | null
  invoiceRef: string | null
  amount: number
  status: string
  notes: string | null
}

const SPEND_TRANSACTIONS: SpendTransactionDef[] = [
  // Matter 0: Merger - outside counsel fees (~$50k total)
  { matterIndex: 0, type: 'OUTSIDE_COUNSEL_FEE', vendorName: 'White & Partners LLP', invoiceRef: 'WPP-2026-001', amount: 25000000, status: 'PAID', notes: 'Merger legal review and due diligence' },
  { matterIndex: 0, type: 'OUTSIDE_COUNSEL_FEE', vendorName: 'White & Partners LLP', invoiceRef: 'WPP-2026-002', amount: 18000000, status: 'APPROVED', notes: 'Second phase due diligence' },
  { matterIndex: 0, type: 'EXPENSE', vendorName: 'TechCorp', invoiceRef: 'TC-REIMB-001', amount: 7500000, status: 'PENDING', notes: 'Travel and accommodation for merger meetings' },
  // Matter 1: Patent litigation (~$30k total)
  { matterIndex: 1, type: 'OUTSIDE_COUNSEL_FEE', vendorName: 'LitigationPro LLP', invoiceRef: 'LPLP-2026-001', amount: 15000000, status: 'PAID', notes: 'Expert witness preparation and testimony' },
  { matterIndex: 1, type: 'FILING_FEE', vendorName: 'USPTO', invoiceRef: 'USPTO-2026-042', amount: 8500000, status: 'PAID', notes: 'Patent infringement filing fees' },
  { matterIndex: 1, type: 'EXPENSE', vendorName: 'Forensic Tech Inc', invoiceRef: 'FTI-2026-015', amount: 6500000, status: 'PENDING', notes: 'Digital forensics report' },
  // Matter 2: Employment compliance (~$15k total)
  { matterIndex: 2, type: 'OUTSIDE_COUNSEL_FEE', vendorName: 'EmploymentLaw Advisors', invoiceRef: 'ELA-2026-003', amount: 10000000, status: 'APPROVED', notes: 'Employment policy compliance review' },
  { matterIndex: 2, type: 'SOFTWARE', vendorName: 'ComplianceHub', invoiceRef: 'CH-2026-001', amount: 5000000, status: 'PAID', notes: 'Annual compliance software subscription' },
  // Matter 3: IP portfolio (~$5k total)
  { matterIndex: 3, type: 'FILING_FEE', vendorName: 'EPO', invoiceRef: 'EPO-2026-088', amount: 3500000, status: 'PAID', notes: 'European patent filing fees' },
  { matterIndex: 3, type: 'FILING_FEE', vendorName: 'USPTO', invoiceRef: 'USPTO-2026-099', amount: 1500000, status: 'PENDING', notes: 'US patent continuation filing' },
]

interface SpendBudgetDef {
  matterIndex: number
  totalAmount: number
}

const SPEND_BUDGETS: SpendBudgetDef[] = [
  { matterIndex: 0, totalAmount: 20000000 }, // $200,000 for merger matter
  { matterIndex: 3, totalAmount: 10000000 }, // $100,000 for IP matter
]

interface KBEntryDef {
  title: string
  body: string
  tags: string[]
}

const KB_ENTRIES: KBEntryDef[] = [
  {
    title: 'Getting Started with Legal Ops',
    body: 'This guide covers the fundamentals of managing legal operations in Laiw. Learn how to create matters, track contracts, manage spend, and collaborate with your team. Laiw provides a unified workspace for in-house legal teams, combining AI-powered assistance with robust management tools.\n\nKey features include matter tracking, contract lifecycle management, spend analytics, knowledge base, and intake automation.',
    tags: ['getting-started', 'overview', 'legal-ops'],
  },
  {
    title: 'Contract Management Best Practices',
    body: 'Effective contract management is essential for minimizing risk and maximizing value. This guide outlines best practices for contract creation, review, execution, and ongoing management.\n\n1. Standardize your contract templates and clauses\n2. Establish clear approval workflows\n3. Track key dates and renewal terms\n4. Maintain version control with redline tracking\n5. Use automated reminders for critical deadlines\n\nLaiw supports all these practices through its integrated contract management module.',
    tags: ['contracts', 'best-practices', 'workflow'],
  },
  {
    title: 'Spend Management and Budgeting',
    body: 'Understanding and controlling legal spend is crucial for budget management and cost efficiency. This guide covers how to set up budgets, track transactions, and analyze spend patterns.\n\nSpend categories include outside counsel fees, expenses, filing fees, and software costs. Set per-matter budgets, track actual spend against budgeted amounts, and generate reports for financial review.',
    tags: ['spend', 'budgeting', 'finance', 'reporting'],
  },
]

interface IntakeSubmissionDef {
  submitter: string
  answers: Record<string, string>
  status: string
  matterIndex?: number
}

const INTAKE_SUBMISSIONS: IntakeSubmissionDef[] = [
  {
    submitter: 'john.doe@acme.law',
    answers: {
      requestType: 'Contract Review',
      urgency: 'High',
      description: 'Need urgent review of vendor MSA with new cloud provider',
      preferredReviewer: 'Jane Lawyer',
    },
    status: 'TRIAGED',
    matterIndex: 0,
  },
  {
    submitter: 'jane.doe@partner.com',
    answers: {
      requestType: 'New Matter',
      urgency: 'Medium',
      description: 'New IP portfolio management matter for patent licensing',
      preferredReviewer: 'Admin User',
    },
    status: 'RECEIVED',
    matterIndex: 3,
  },
]

interface TaskDef {
  matterIndex: number
  title: string
  description: string | null
  assigneeIndex: number
  status: string
  priority: string
  dueDate?: string
}

const TASKS: TaskDef[] = [
  { matterIndex: 0, title: 'Complete due diligence checklist', description: 'Review and complete all items on the merger due diligence checklist', assigneeIndex: 1, status: 'IN_PROGRESS', priority: 'HIGH', dueDate: '2026-06-15' },
  { matterIndex: 0, title: 'Draft closing memorandum', description: 'Prepare closing memorandum for the TechCorp merger', assigneeIndex: 0, status: 'PENDING', priority: 'MEDIUM', dueDate: '2026-07-01' },
  { matterIndex: 1, title: 'Prepare expert witness testimony', description: 'Coordinate with expert witness for patent infringement case deposition', assigneeIndex: 1, status: 'PENDING', priority: 'URGENT', dueDate: '2026-06-01' },
  { matterIndex: 2, title: 'Update employee handbook', description: 'Incorporate new compliance requirements into employee handbook', assigneeIndex: 2, status: 'IN_PROGRESS', priority: 'MEDIUM', dueDate: '2026-07-15' },
]

async function seed() {
  // Idempotency: check if org already exists
  const existingOrg = await prisma.organization.findFirst({
    where: { name: ORG_NAME },
  })

  if (existingOrg) {
    console.log(`\nOrganization "${ORG_NAME}" already exists. Skipping seed.`)
    await prisma.$disconnect()
    return
  }

  const hashedPassword = await hashPassword(DEMO_PASSWORD)

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const counts: Record<string, number> = {}

    // ── 1. Create Organization ──
    const org = await tx.organization.create({
      data: {
        name: ORG_NAME,
      },
    })
    counts.organization = 1

    // ── 2. Create Users ──
    const users: { id: string; email: string }[] = []
    for (const u of USERS) {
      const user = await tx.user.create({
        data: {
          email: u.email,
          passwordHash: hashedPassword,
          role: u.role as any,
          firstName: u.firstName,
          lastName: u.lastName,
          organizationId: org.id,
          isActive: true,
        },
        select: { id: true, email: true },
      })
      users.push(user)
    }
    counts.users = users.length

    // ── 3. Create Matters with MatterMembers ──
    const matters: { id: string; name: string }[] = []
    for (const m of MATTERS) {
      const matter = await tx.matter.create({
        data: {
          name: m.name,
          description: m.description,
          status: m.status as any,
          matterType: m.matterType,
          orgId: org.id,
          members: {
            create: USERS.map((u, i) => ({
              userId: users[i].id,
              role: 'member',
            })),
          },
        },
        select: { id: true, name: true },
      })
      matters.push(matter)
    }
    counts.matters = matters.length

    // ── 4. Create Contracts ──
    for (const c of CONTRACTS) {
      const matter = matters[c.matterIndex]

      const contract = await tx.contract.create({
        data: {
          matterId: matter.id,
          title: c.title,
          counterparty: c.counterparty,
          contractType: c.contractType,
          status: c.status as any,
          startDate: c.startDate ? new Date(c.startDate) : undefined,
          endDate: c.endDate ? new Date(c.endDate) : undefined,
          autoRenew: c.autoRenew ?? false,
          contractValue: c.contractValue ? new Decimal(c.contractValue) : undefined,
          currency: c.currency,
          members: {
            create: USERS.map((u, i) => ({
              userId: users[i].id,
              role: i === 0 ? 'owner' : 'reviewer',
            })),
          },
          versions: {
            create: {
              number: 1,
              content: 'Initial draft of contract.',
            },
          },
        },
        select: { id: true, title: true, versions: { select: { id: true, number: true } } },
      })

      // Update currentVersionId after creating the version
      await tx.contract.update({
        where: { id: contract.id },
        data: { currentVersionId: contract.versions[0].id },
      })
    }
    counts.contracts = CONTRACTS.length

    // ── 5. Create Spend Transactions ──
    for (const t of SPEND_TRANSACTIONS) {
      const matter = matters[t.matterIndex]
      await tx.spendTransaction.create({
        data: {
          matterId: matter.id,
          type: t.type as any,
          vendorName: t.vendorName,
          invoiceRef: t.invoiceRef,
          amount: new Decimal(t.amount),
          currency: 'USD',
          status: t.status as any,
          paidAt: t.status === 'PAID' ? new Date('2026-05-15') : null,
          notes: t.notes,
        },
      })
    }
    counts.spendTransactions = SPEND_TRANSACTIONS.length

    // ── 6. Create Spend Budgets ──
    for (const b of SPEND_BUDGETS) {
      const matter = matters[b.matterIndex]
      await tx.spendBudget.create({
        data: {
          matterId: matter.id,
          totalAmount: new Decimal(b.totalAmount),
          currency: 'USD',
          spent: new Decimal(0),
        },
      })
    }
    counts.spendBudgets = SPEND_BUDGETS.length

    // ── 7. Create KB Entries ──
    for (const k of KB_ENTRIES) {
      await tx.kBEntry.create({
        data: {
          orgId: org.id,
          title: k.title,
          body: k.body,
          tags: k.tags,
        },
      })
    }
    counts.kbEntries = KB_ENTRIES.length

    // ── 8. Create Intake Form ──
    const intakeForm = await tx.intakeForm.create({
      data: {
        orgId: org.id,
        name: 'General Legal Request',
        formSchema: JSON.stringify({
          type: 'object',
          properties: {
            requestType: { type: 'string', title: 'Request Type', required: true },
            urgency: { type: 'string', title: 'Urgency', enum: ['Low', 'Medium', 'High', 'Urgent'], required: true },
            description: { type: 'string', title: 'Description', required: true },
            preferredReviewer: { type: 'string', title: 'Preferred Reviewer' },
          },
        }),
        isActive: true,
      },
    })
    counts.intakeForms = 1

    // ── 9. Create Intake Submissions ──
    for (const s of INTAKE_SUBMISSIONS) {
      const matterId = s.matterIndex !== undefined ? matters[s.matterIndex].id : null
      await tx.intakeSubmission.create({
        data: {
          formId: intakeForm.id,
          submitter: s.submitter,
          answers: JSON.stringify(s.answers),
          status: s.status as any,
          matterId: matterId || undefined,
        },
      })
    }
    counts.intakeSubmissions = INTAKE_SUBMISSIONS.length

    // ── 10. Create Tasks ──
    for (const t of TASKS) {
      const matter = matters[t.matterIndex]
      await tx.task.create({
        data: {
          matterId: matter.id,
          title: t.title,
          description: t.description,
          status: t.status as any,
          priority: t.priority as any,
          assigneeId: users[t.assigneeIndex].id,
          dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
        },
      })
    }
    counts.tasks = TASKS.length

    return counts
  })

  // ── Print Summary ──
  console.log('\n' + '='.repeat(50))
  console.log(`  Seed data created for: ${ORG_NAME}`)
  console.log('='.repeat(50))
  console.log(`  Organization:        ${result.organization}`)
  console.log(`  Users:               ${result.users}`)
  console.log(`  Matters:             ${result.matters}`)
  console.log(`  Contracts:           ${result.contracts}`)
  console.log(`  Spend Transactions:  ${result.spendTransactions}`)
  console.log(`  Spend Budgets:       ${result.spendBudgets}`)
  console.log(`  KB Entries:          ${result.kbEntries}`)
  console.log(`  Intake Forms:        ${result.intakeForms}`)
  console.log(`  Intake Submissions:  ${result.intakeSubmissions}`)
  console.log(`  Tasks:               ${result.tasks}`)
  console.log('='.repeat(50))
  console.log('  Demo credentials (all users):')
  console.log(`  Password: "${DEMO_PASSWORD}"`)
  console.log('  admin@acme.law     (ADMIN)')
  console.log('  lawyer@acme.law    (ATTORNEY)')
  console.log('  paralegal@acme.law (PARALEGAL)')
  console.log('='.repeat(50) + '\n')

  await prisma.$disconnect()
}

export default seed

if (process.argv[2] === '--run') {
  seed().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
}

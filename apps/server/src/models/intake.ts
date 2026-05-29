import { prisma } from './prisma'

export async function createForm(orgId: string, name: string, formSchema: string | null) {
  return prisma.intakeForm.create({
    data: {
      orgId,
      name,
      formSchema,
    },
  })
}

export async function listForms(orgId: string) {
  return prisma.intakeForm.findMany({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { submissions: true } },
    },
  })
}

export async function submitForm(formId: string, submitter: string, answers: Record<string, unknown>) {
  return prisma.intakeSubmission.create({
    data: {
      formId,
      submitter,
      answers: JSON.stringify(answers),
    },
  })
}

export async function submitFormWithTriage(
  formId: string,
  submitter: string,
  answers: Record<string, unknown>,
  triageResult: Record<string, unknown>,
) {
  return prisma.intakeSubmission.create({
    data: {
      formId,
      submitter,
      answers: JSON.stringify(answers),
      triageResult: JSON.stringify(triageResult),
      status: 'TRIAGED',
    },
  })
}

export async function updateSubmissionTriage(submissionId: string, triageResult: Record<string, unknown>) {
  return prisma.intakeSubmission.update({
    where: { id: submissionId },
    data: {
      triageResult: JSON.stringify(triageResult),
      status: 'TRIAGED',
    },
  })
}

export async function listSubmissions(formId?: string, status?: string, orgId?: string) {
  const where: Record<string, unknown> = {}
  if (formId) where.formId = formId
  if (status) where.status = status

  const results = await prisma.intakeSubmission.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      form: { select: { name: true, orgId: true } },
      matter: { select: { id: true, name: true } },
    },
  })

  // Filter by orgId if provided
  if (orgId) {
    const filtered: typeof results = []
    for (const s of results) {
      if ((s as { form: { orgId: string } }).form.orgId === orgId) {
        filtered.push(s)
      }
    }
    return filtered
  }

  return results
}

export async function getSubmission(submissionId: string) {
  return prisma.intakeSubmission.findUnique({
    where: { id: submissionId },
    include: {
      form: true,
      matter: true,
    },
  })
}

export async function updateSubmissionStatus(submissionId: string, status: string, matterId: string | null = null) {
  return prisma.intakeSubmission.update({
    where: { id: submissionId },
    data: {
      status: status as any,
      matterId: matterId || undefined,
    },
  })
}

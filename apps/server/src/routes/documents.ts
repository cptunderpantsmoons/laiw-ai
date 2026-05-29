import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import multer from 'multer'
import { prisma } from '../models/prisma'
import { uploadFile } from '../services/storage.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('unsupported file type'))
    }
  },
})

async function getOrgId(_req: AuthRequest): Promise<string | null> {
  // authMiddleware now sets req.orgId
  return _req.orgId ?? null
}

// GET /api/documents
router.get('/documents', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const matterId = req.query.matterId as string | undefined
    const where: { matterId?: string } = {}
    if (matterId) where.matterId = matterId

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { matter: { select: { name: true } } },
    })
    res.json(documents)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/documents (multipart file upload)
router.post('/documents', authMiddleware, upload.single('file'), async (req: AuthRequest & { file?: Express.Multer.File }, res: Response) => {
  try {
    const { matterId, name, contractId } = req.body
    if (!matterId || !req.file) return res.status(400).json({ error: 'matterId and file required' })
    const orgId = req.orgId
    if (!orgId) return res.status(400).json({ error: 'no organization' })
    const matter = await prisma.matter.findFirst({
      where: { id: matterId, orgId },
      select: { id: true },
    })
    if (!matter) return res.status(404).json({ error: 'matter not found' })

    const storageKey = await uploadFile(
      `uploads/${req.userId}/${Date.now()}-${req.file.originalname}`,
      req.file.buffer,
      req.file.mimetype
    )

    const document = await prisma.document.create({
      data: {
        matterId,
        name: name || req.file.originalname,
        mimeType: req.file.mimetype,
        storageKey,
        size: req.file.size,
        uploadedBy: req.userId!,
        contractId: contractId || null,
      },
    })

    res.status(201).json(document)
  } catch (err) {
    const message = (err as Error).message
    if (message === 'unsupported file type') {
      return res.status(400).json({ error: 'unsupported file type' })
    }
    res.status(500).json({ error: message })
  }
})

// GET /api/documents/:id
router.get('/documents/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id as string },
      include: { matter: { select: { name: true } } },
    })
    if (!document) return res.status(404).json({ error: 'document not found' })
    res.json(document)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router

import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import multer from 'multer'
import {
  getDocService,
} from '../services/index.js'
import type { DocumentVersion, VersionSource } from '@teamsuzie/document-versions'

const router: Router = Router()


// Multer setup: store files in memory for document conversion
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/csv',
      'text/markdown',
    ]
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('unsupported file type'))
    }
  },
})

// ── AI Document Routes ──────────────────────────────────

// POST /api/ai/documents/convert — Convert a document file to markdown
router.post('/ai/documents/convert', authMiddleware, upload.single('file'), async (
  req: AuthRequest & { file?: Express.Multer.File },
  res: Response,
) => {
  try {
    const { matterId, mimeType: requestedMimeType } = req.body
    if (!req.file) return res.status(400).json({ error: 'file required' })
    if (!matterId) return res.status(400).json({ error: 'matterId required' })

    const mimeType = requestedMimeType || req.file.mimetype
    const docService = getDocService()
    const result = await docService.convertDocument(
      req.file.buffer,
      mimeType,
      matterId as string,
      req.file.originalname,
    )
    res.status(201).json(result)
  } catch (err) {
    const message = (err as Error).message
    if (message === 'unsupported file type') {
      return res.status(400).json({ error: 'unsupported file type' })
    }
    res.status(500).json({ error: message })
  }
})

// POST /api/ai/documents/:matterId/versions — Create a new version
router.post('/ai/documents/:matterId/versions', authMiddleware, async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const matterId = req.params.matterId as string
    const { content, previousVersionId, versionSource, notes } = req.body
    if (!content) return res.status(400).json({ error: 'content required' })

    const docService = getDocService()
    const typedSource = (versionSource as VersionSource) || 'proposal'
    const result = await docService.createVersion(
      content,
      previousVersionId,
      typedSource,
      notes,
    )
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/ai/documents/:versionId — Get a document version detail
router.get('/ai/documents/:versionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const versionId = req.params.versionId as string
    const docService = getDocService()
    const version: DocumentVersion | null = docService.getVersion(versionId)

    if (!version) return res.status(404).json({ error: 'document version not found' })

    res.json(version)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/ai/documents/:versionId/docx — Generate a DOCX from markdown
router.post('/ai/documents/:versionId/docx', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const versionId = req.params.versionId as string
    const { content, filename } = req.body
    if (!content) return res.status(400).json({ error: 'content required' })

    const docService = getDocService()
    const result = await docService.generateDocx(versionId, content, filename)
    res.status(201).json({
      versionId,
      filename: filename || `${versionId}.docx`,
      bytes: result.docxBuffer.length,
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router

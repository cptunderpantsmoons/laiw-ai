import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import { getContactService } from '../services/index.js'

const router: import('express').Router = Router()


// POST /api/contacts — Create contact
router.post('/contacts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const contactService = getContactService()
    const result = await contactService.createContact(name, email, phone, req.userId!)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/contacts — List contacts
router.get('/contacts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const contactService = getContactService()
    const contacts = await contactService.listContacts(
      req.query.userId as string | undefined,
      req.query.orgId as string | undefined,
    )
    res.json(contacts)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/contacts/:contactId — Get contact
router.get('/contacts/:contactId', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const contactService = getContactService()
    const contact = await contactService.getContact(_req.params.contactId as string)
    if (!contact) return res.status(404).json({ error: 'contact not found' })
    res.json(contact)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/contacts/:contactId — Update contact
router.patch('/contacts/:contactId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone } = req.body
    const contactService = getContactService()
    await contactService.updateContact(req.params.contactId as string, { name, email, phone })
    const updated = await contactService.getContact(req.params.contactId as string)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// DELETE /api/contacts/:contactId — Delete contact
router.delete('/contacts/:contactId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const contactService = getContactService()
    await contactService.deleteContact(req.params.contactId as string)
    res.json({ success: true, contactId: req.params.contactId })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router

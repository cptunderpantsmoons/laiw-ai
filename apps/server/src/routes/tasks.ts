import { Router, Request, Response } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import { getTaskService } from '../services/index.js'

const router: import('express').Router = Router()


// POST /api/tasks — Create task
router.post('/tasks', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId, title, description, assigneeId, dueDate, priority, status } = req.body
    if (!matterId) return res.status(400).json({ error: 'matterId required' })
    if (!title) return res.status(400).json({ error: 'title required' })
    const taskService = getTaskService()
    const task = await taskService.createTask(
      matterId,
      title,
      description,
      assigneeId || undefined,
      dueDate ? new Date(dueDate) : undefined,
      priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | undefined,
      status as 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | undefined,
    )
    res.status(201).json(task)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/tasks — List tasks
router.get('/tasks', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const taskService = getTaskService()
    const tasks = await taskService.listTasks(
      req.query.matterId as string | undefined,
      req.query.assigneeId as string | undefined,
      req.query.status as string | undefined,
    )
    res.json(tasks)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/tasks/:taskId — Get task
router.get('/tasks/:taskId', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const taskService = getTaskService()
    const task = await taskService.getTask(_req.params.taskId as string)
    if (!task) return res.status(404).json({ error: 'task not found' })
    res.json(task)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// PATCH /api/tasks/:taskId — Update task
router.patch('/tasks/:taskId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, status, priority, assigneeId, dueDate } = req.body
    const taskService = getTaskService()
    const task = await taskService.updateTask(req.params.taskId as string, {
      title,
      description,
      status,
      priority,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    })
    res.json(task)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// DELETE /api/tasks/:taskId — Delete task
router.delete('/tasks/:taskId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const taskService = getTaskService()
    await taskService.deleteTask(req.params.taskId as string)
    res.json({ success: true, taskId: req.params.taskId })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router

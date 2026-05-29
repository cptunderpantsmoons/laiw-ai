import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware, type AuthRequest } from '../auth/middleware.js'
import {
  getChatService,
} from '../services/index.js'
import type { ChatWithMessages, ChatService } from '../services/chat-service'
import type { ChatMessage } from '@teamsuzie/agent-loop'

const router: Router = Router()


// ── AI Chat Routes ──────────────────────────────────────

// POST /api/ai/chat — Create a new chat for a matter
router.post('/ai/chat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { matterId, title } = req.body
    if (!matterId) return res.status(400).json({ error: 'matterId required' })

    const chatService = getChatService()
    const result = await chatService.createChat(matterId as string, title)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/ai/chat/:chatId/message — Send a message to a chat
router.post('/ai/chat/:chatId/message', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content, role } = req.body
    const chatId = req.params.chatId as string
    if (!content) return res.status(400).json({ error: 'content required' })

    const chatService = getChatService()
    const response = await chatService.sendMessage(chatId, content, role || 'user')
    res.status(201).json({ response })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/ai/chat/:chatId/messages — Get all messages in a chat
router.get('/ai/chat/:chatId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const chatId = req.params.chatId as string
    const chatService = getChatService()
    const result = await chatService.getChat(chatId)

    if (!result) return res.status(404).json({ error: 'chat not found' })

    res.json(result.messages)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/ai/chats?matterId=X — List all chats for a matter
router.get('/ai/chats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const matterId = req.query.matterId as string
    if (!matterId) return res.status(400).json({ error: 'matterId query param required' })

    const chatService = getChatService()
    const chats = await chatService.listChats(matterId)
    res.json(chats)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// GET /api/ai/chat/:chatId — Get chat detail with messages
router.get('/ai/chat/:chatId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const chatId = req.params.chatId as string
    const chatService = getChatService()
    const result = await chatService.getChat(chatId)

    if (!result) return res.status(404).json({ error: 'chat not found' })

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// POST /api/ai/chat/:chatId/stream — Stream chat completion (SSE)
router.post('/ai/chat/:chatId/stream', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const chatId = req.params.chatId as string
    const { content, role } = req.body
    if (!content) return res.status(400).json({ error: 'content required' })

    const chatService = getChatService()

    // Set up SSE response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    // Get existing messages for context
    const chatWithMessages: ChatWithMessages | null = await chatService.getChat(chatId)
    if (!chatWithMessages) {
      res.write('data: ' + JSON.stringify({ type: 'error', message: 'chat not found' }) + '\n\n')
      res.end()
      return
    }

    const storeMessages = chatWithMessages.messages
    const agentMessages: ChatMessage[] = storeMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Append the user message
    const fullMessage: ChatMessage = {
      role: role === 'system' ? 'system' : 'user',
      content,
    }

    // Stream using runChatTurn from agent-loop
    const { runChatTurn } = await import('@teamsuzie/agent-loop')

    let fullResponse = ''
    try {
      const toolCtx: any = {
        approvals: {
          queue: [],
          add: async () => ({ id: '', status: 'pending' }),
          approve: async () => {},
          reject: async () => {},
        },
        vectorDbBaseUrl: process.env.VECTOR_DB_URL || 'http://localhost:3013',
        fetchImpl: fetch,
      }

      for await (const event of runChatTurn({
        agent: (chatService as any).agent,
        messages: [...agentMessages, fullMessage],
        tools: (chatService as any).extraTools ?? [],
        toolCtx,
        systemPrompt: (chatService as any).systemPrompt,
      })) {
        if (event.type === 'chunk' && event.text) {
          fullResponse += event.text
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: event.text })}\n\n`)
        }
      }

      // Persist the assistant response
      try {
        await chatService.sendMessage(chatId, fullResponse, 'user' as 'user' | 'system')
      } catch { /* best-effort persistence */ }

      res.write(`data: ${JSON.stringify({ type: 'done', response: fullResponse })}\n\n`)
      res.end()
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`)
      res.end()
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router

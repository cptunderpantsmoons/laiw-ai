import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Button,
  Textarea,
  Badge,
  EmptyState,
  Sparkles,
  Send,
  Loader2,
  MessageSquare,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
} from '@teamsuzie/ui'
import { fetchApi } from '../api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatPanelProps {
  matterId: string
  open: boolean
  onToggle: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatPanel({ matterId, open, onToggle }: ChatPanelProps) {
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // --- Initialise chat session (creates or loads existing) ---

  useEffect(() => {
    if (!open || !matterId) return

    let cancelled = false
    setError(null)

    // Try to find an existing chat for this matter, or create a new one.
    fetchApi<{ id: string }>(`/matters/${matterId}/ai-chat`)
      .then(res => {
        if (!cancelled) setChatId(res.id)
      })
      .catch(() => {
        // If the endpoint returns 404 (no chat yet), create one.
        if (!cancelled) {
          fetchApi<{ id: string }>(`/matters/${matterId}/ai-chat`, { method: 'POST' })
            .then(r => {
              if (!cancelled) setChatId(r.id)
            })
            .catch((e: unknown) => {
              if (!cancelled) setError((e as Error).message)
            })
        }
      })

    return () => { cancelled = true }
  }, [open, matterId])

  // --- Load existing messages when chatId arrives ---

  useEffect(() => {
    if (!open || !chatId) return

    let cancelled = false
    fetchApi<ChatMessage[]>(`/api/ai/chats/${chatId}/messages`)
      .then(res => {
        if (!cancelled) setMessages(res)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message)
      })

    return () => { cancelled = true }
  }, [open, chatId])

  // --- Scroll to bottom on new messages ---

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // --- Send handler (streaming with SSE fallback) ---

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || streaming || !chatId) return

    const userMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setError(null)

    // Optimistic assistant placeholder
    const assistantPlaceholderId = `tmp-assistant-${Date.now()}`
    setMessages(prev => [
      ...prev,
      {
        id: assistantPlaceholderId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      },
    ])

    // Try streaming SSE endpoint first
    try {
      const sseUrl = `/api/ai/chats/${chatId}/messages/stream`
      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch(`${sseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let partial = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                return
              }
              partial += data
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantPlaceholderId
                    ? { ...m, content: partial }
                    : m
                )
              )
            }
          }
        }
      }
    } catch (err) {
      // SSE failed — fall back to regular fetch
      abortRef.current = null
      try {
        const data = await fetchApi<{ content: string; timestamp?: string }>(
          `/api/ai/chats/${chatId}/messages`,
          { method: 'POST', body: JSON.stringify({ message: trimmed }) }
        )

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantPlaceholderId
              ? { ...m, content: data.content, timestamp: data.timestamp || new Date().toISOString() }
              : m
          )
        )
      } catch (e) {
        setError((e as Error).message)
        // Replace placeholder with error message
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantPlaceholderId
              ? { ...m, content: 'Sorry, I encountered an error. Please try again.' }
              : m
          )
        )
      }
    }

    setStreaming(false)
  }, [input, streaming, chatId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTextareaResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  // --- Render ---

  if (!open) return null

  return (
    <aside className="flex h-screen w-96 flex-col border-l border-slate-200 bg-white shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-500" />
          <span className="font-semibold text-slate-900">AI Assistant</span>
          {chatId && (
            <Badge variant="outline" className="ml-1 text-[10px]">
              {matterId}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onToggle}>
          <CloseIcon className="size-4" />
        </Button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
            <button
              className="ml-2 underline hover:no-underline"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {!chatId && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="size-8 text-slate-300 mb-3" />
            <p className="text-sm text-muted-foreground">Connecting to AI...</p>
          </div>
        )}

        {messages.length === 0 && chatId && !error && (
          <EmptyState>
            <EmptyStateIcon>
              <MessageSquare className="size-5" />
            </EmptyStateIcon>
            <EmptyStateTitle>No messages yet</EmptyStateTitle>
            <EmptyStateDescription>
              Ask the AI assistant anything about this matter.
            </EmptyStateDescription>
          </EmptyState>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-900'
              }`}
            >
              {/* Role label (assistant only) */}
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="size-3 text-amber-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                    AI
                  </span>
                  {getTimestampBadge(msg.timestamp)}
                </div>
              )}

              {/* Message content */}
              <p className="text-sm whitespace-pre-wrap break-words">
                {msg.content || (msg.role === 'assistant' && streaming ? 'Thinking...' : '')}
              </p>

              {/* Timestamp for user */}
              {msg.role === 'user' && (
                <div className="text-right mt-1">
                  {getTimestampBadge(msg.timestamp)}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {streaming && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              AI is thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-200">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              handleTextareaResize(e.target)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this matter..."
            className="min-h-[36px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-2 py-1 text-sm shadow-none focus-visible:ring-0"
            disabled={streaming}
            rows={1}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="size-8 shrink-0 rounded-md"
          >
            {streaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTimestampBadge(ts: string): React.ReactNode {
  const d = new Date(ts)
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums">
      {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

// Re-export EmptyState sub-components for convenience in callers.
export { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription }

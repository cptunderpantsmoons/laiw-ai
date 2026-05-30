import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchApi } from '../api'
import { Sparkles, Send, Loader2, MessageSquare, Plus, Sidebar } from '@teamsuzie/ui'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  matterId?: string
}

interface ChatSession {
  id: string
  title: string
  matterId?: string
  matterName?: string
  lastMessageAt: string
}

export default function AIChat() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [contextMatter, setContextMatter] = useState<{ id: string; name: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load chat sessions
  useEffect(() => {
    let cancelled = false
    fetchApi<ChatSession[]>('/api/ai/chats')
      .then(res => {
        if (!cancelled) {
          setSessions(res)
          if (res.length > 0 && !currentSessionId) {
            setCurrentSessionId(res[0].id)
          }
        }
      })
      .catch(() => {
        // Ignore errors for now
      })
    return () => { cancelled = true }
  }, [])

  // Load messages when session changes
  useEffect(() => {
    if (!currentSessionId) return

    let cancelled = false
    setMessages([])
    setContextMatter(null)
    
    fetchApi<ChatMessage[]>(`/api/ai/chats/${currentSessionId}/messages`)
      .then(res => {
        if (!cancelled) {
          setMessages(res)
          // Extract matter context if available
          const matterMsg = res.find(m => m.role === 'system' && m.content.startsWith('matter:'))
          if (matterMsg) {
            const [, matterId, matterName] = matterMsg.content.split('|')
            setContextMatter({ id: matterId, name: matterName })
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message)
      })

    return () => { cancelled = true }
  }, [currentSessionId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const createNewChat = useCallback(async (matterId?: string) => {
    try {
      let sessionId: string
      
      if (matterId) {
        const res = await fetchApi<{ id: string }>(`/matters/${matterId}/ai-chat`, { method: 'POST' })
        sessionId = res.id
      } else {
        // Create a general chat (no matter context)
        const res = await fetchApi<{ id: string }>('/api/ai/chats', { 
          method: 'POST',
          body: JSON.stringify({ title: 'New Chat' })
        })
        sessionId = res.id
      }

      setSessions(prev => {
        const newSession = { id: sessionId, title: 'New Chat', lastMessageAt: new Date().toISOString() }
        return [newSession, ...prev.filter(s => s.id !== sessionId)]
      })
      setCurrentSessionId(sessionId)
      setMessages([])
      setContextMatter(null)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || streaming || !currentSessionId) return

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

    try {
      const sseUrl = `/api/ai/chats/${currentSessionId}/messages/stream`
      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch(sseUrl, {
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
      abortRef.current = null
      try {
        const data = await fetchApi<{ content: string; timestamp?: string }>(
          `/api/ai/chats/${currentSessionId}/messages`,
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
  }, [input, streaming, currentSessionId])

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

  const selectMatterContext = async () => {
    // Simple prompt for matter ID - in production this would be a proper modal
    const matterId = prompt('Enter Matter ID:')
    if (matterId) {
      try {
        const matter = await fetchApi<{ id: string; name: string }>(`/matters/${matterId}`)
        await createNewChat(matter.id)
      } catch (e) {
        setError('Matter not found')
      }
    }
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Chats</h2>
              <button
                onClick={() => createNewChat()}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="New Chat"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <button
              onClick={selectMatterContext}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <MessageSquare className="size-4" />
              Chat with Matter
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => setCurrentSessionId(session.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentSessionId === session.id
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="font-medium truncate">{session.title || 'Untitled'}</div>
                {session.matterName && (
                  <div className="text-xs text-slate-500 truncate">{session.matterName}</div>
                )}
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(session.lastMessageAt).toLocaleDateString()}
                </div>
              </button>
            ))}
            {sessions.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-500">
                No chat history yet
              </div>
            )}
          </div>
          <div className="p-4 border-t border-slate-200">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Sidebar className="size-4" />
              Classic View
            </button>
          </div>
        </aside>
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Sidebar className="size-4" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              <span className="font-semibold text-slate-900">AI Assistant</span>
            </div>
            {contextMatter && (
              <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                {contextMatter.name}
              </span>
            )}
          </div>
          {!currentSessionId && (
            <button
              onClick={() => createNewChat()}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Plus className="size-4" />
              New Chat
            </button>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!currentSessionId ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="size-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  How can I help you today?
                </h1>
                <p className="text-slate-600 mb-6">
                  Start a conversation with your AI legal assistant. Ask about matters, contracts, compliance, or any legal question.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => createNewChat()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                  >
                    <Plus className="size-4" />
                    New Chat
                  </button>
                  <button
                    onClick={selectMatterContext}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    <MessageSquare className="size-4" />
                    Chat with Matter
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
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

              {messages.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="size-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Start the conversation...</p>
                </div>
              )}

              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white border border-slate-200 text-slate-900 shadow-sm'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="size-3 text-amber-500" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                          AI
                        </span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content || (msg.role === 'assistant' && streaming ? 'Thinking...' : '')}
                    </p>
                  </div>
                </div>
              ))}

              {streaming && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-600 shadow-sm">
                    <Loader2 className="size-4 animate-spin" />
                    AI is thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {currentSessionId && (
          <div className="border-t border-slate-200 bg-white p-4 shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200 shadow-sm">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    handleTextareaResize(e.target)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  className="flex-1 resize-none border-0 bg-transparent px-2 py-1 text-sm max-h-[160px] focus:outline-none focus:ring-0"
                  rows={1}
                  disabled={streaming}
                />
                <button
                  onClick={sendMessage}
                  disabled={streaming || !input.trim()}
                  className={`shrink-0 p-2 rounded-lg transition-colors ${
                    streaming || !input.trim()
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {streaming ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 text-center mt-2">
                AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

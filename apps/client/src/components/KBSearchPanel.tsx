import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  LoadingState,
  EmptyState,
  FileText,
  Search,
  Tag,
  Folder,
  ExternalLink,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
} from '@teamsuzie/ui'
import { fetchApi } from '../api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KbResult {
  id: string
  title: string
  content: string
  snippet: string
  tags: string[]
  relatedMatter?: string
  relatedMatterId?: string
  score?: number
  lastUpdated: string
}

export interface KBSearchPanelProps {
  orgId: string
  matterId?: string
  open: boolean
  onToggle: () => void
}

// ---------------------------------------------------------------------------
// Debounce hook (inline to keep this file self-contained)
// ---------------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KBSearchPanel({
  orgId,
  matterId,
  open,
  onToggle,
}: KBSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KbResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const debouncedQuery = useDebouncedValue(query, 300)
  const initialFetchDone = useRef(false)

  // --- Fetch results when debounced query changes ---

  const doSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !open) return

      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ orgId, query: searchQuery.trim() })
        if (matterId) params.set('matterId', matterId)

        const data = await fetchApi<{ items: KbResult[] }>(`/api/ai/kb/search?${params}`)
        setResults(data.items)
        // Auto-expand first result when initially loaded
        if (!initialFetchDone.current && data.items.length > 0) {
          initialFetchDone.current = true
          setExpandedId(data.items[0].id)
        }
      } catch (err) {
        setError((err as Error).message)
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [orgId, matterId, open]
  )

  useEffect(() => {
    if (debouncedQuery.trim()) {
      doSearch(debouncedQuery)
    } else {
      setResults([])
      setError(null)
      initialFetchDone.current = false
    }
  }, [debouncedQuery, doSearch])

  // --- Reset when panel opens ---

  useEffect(() => {
    if (open) {
      initialFetchDone.current = false
    }
  }, [open])

  // --- Expand / collapse ---

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  // --- Render ---

  if (!open) return null

  return (
    <aside className="flex h-screen w-96 flex-col border-l border-slate-200 bg-white shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-blue-500" />
          <span className="font-semibold text-slate-900">Knowledge Base</span>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onToggle}>
          <CloseIcon className="size-4" />
        </Button>
      </div>

      {/* Search bar */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search knowledge base..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {matterId && (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Folder className="size-3" />
            Scoping to matter: {matterId}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
            <button className="ml-2 underline hover:no-underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* Empty / loading states */}
        {!query.trim() && !loading && !error && (
          <EmptyState>
            <EmptyStateIcon>
              <FileText className="size-5" />
            </EmptyStateIcon>
            <EmptyStateTitle>Search the knowledge base</EmptyStateTitle>
            <EmptyStateDescription>
              Find policies, precedents, and reference materials.
            </EmptyStateDescription>
          </EmptyState>
        )}

        {loading && results.length === 0 && !query.trim() && (
          <LoadingState variant="block">Searching…</LoadingState>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </p>
            {results.map(result => (
              <ResultCard
                key={result.id}
                result={result}
                expanded={expandedId === result.id}
                onToggle={() => toggleExpand(result.id)}
              />
            ))}
          </div>
        )}

        {!loading && results.length === 0 && query.trim() && !error && (
          <EmptyState>
            <EmptyStateIcon>
              <Search className="size-5" />
            </EmptyStateIcon>
            <EmptyStateTitle>No results found</EmptyStateTitle>
            <EmptyStateDescription>
              Try a different search query or broaden your scope.
            </EmptyStateDescription>
          </EmptyState>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-2 text-center">
        <p className="text-[10px] text-muted-foreground">
          Powered by Laiw AI · {results.length} items
        </p>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

function ResultCard({
  result,
  expanded,
  onToggle,
}: {
  result: KbResult
  expanded: boolean
  onToggle: () => void
}) {
  const snippetText = result.snippet || result.content

  return (
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-md border-slate-200 ${
        expanded ? 'ring-2 ring-blue-200' : ''
      }`}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        {/* Title + related matter */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <FileText className="size-4 shrink-0 text-blue-500 mt-0.5" />
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-slate-900 truncate">
                {result.title}
              </h4>
              {result.relatedMatter && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                  <Folder className="size-3" />
                  <span className="truncate">{result.relatedMatter}</span>
                  {result.relatedMatterId && (
                    <ExternalLink className="size-3 shrink-0" />
                  )}
                </div>
              )}
            </div>
          </div>

          {result.score !== undefined && (
            <span className="text-[10px] font-semibold text-emerald-600 shrink-0">
              {(result.score * 100).toFixed(0)}% match
            </span>
          )}
        </div>

        {/* Snippet (truncated inline) */}
        {!expanded && snippetText && (
          <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
            {snippetText}
          </p>
        )}

        {/* Tags */}
        {result.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {result.tags.slice(0, expanded ? undefined : 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                <Tag className="size-2.5" />
                {tag}
              </Badge>
            ))}
            {result.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{result.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Expanded content */}
        {expanded && snippetText && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
              {snippetText}
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Last updated: {new Date(result.lastUpdated).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// Re-export EmptyState sub-components for callers
export { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription }

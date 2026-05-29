import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  LoadingState,
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  GitCompareArrows,
  Check,
  Loader2,
  History,
  Eye,
} from '@teamsuzie/ui'
import { fetchApi } from '../api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewItem {
  id: string
  clauseNumber?: string
  originalText: string
  proposedChange: string
  status: 'pending' | 'accepted' | 'rejected' | 'flagged'
  category?: string
  updatedAt: string
}

export interface ReviewSummary {
  total: number
  accepted: number
  rejected: number
  pending: number
  flagged: number
}

export type ReviewTab = 'review' | 'changes' | 'history'

export interface RedlinePanelProps {
  contractVersionId: string
  open: boolean
  onToggle: () => void
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusBadgeVariant(status: ReviewItem['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'accepted': return 'default'
    case 'rejected': return 'destructive'
    case 'flagged': return 'secondary'
    default: return 'outline'
  }
}

// Small inline badge with size styling (Badge component has no size prop)
function MiniBadge({
  variant,
  children,
}: {
  variant: 'default' | 'destructive' | 'outline' | 'secondary'
  children: React.ReactNode
}) {
  const cls: Record<string, string> = {
    default: 'bg-green-100 text-green-700',
    destructive: 'bg-red-100 text-red-700',
    outline: 'border border-slate-300 text-slate-600',
    secondary: 'bg-slate-200 text-slate-700',
  }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls[variant] || cls.outline}`}>
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RedlinePanel({ contractVersionId, open, onToggle }: RedlinePanelProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [summary, setSummary] = useState<ReviewSummary>({ total: 0, accepted: 0, rejected: 0, pending: 0, flagged: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ReviewTab>('review')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // --- Fetch reviews ---

  const fetchReviews = useCallback(() => {
    if (!open || !contractVersionId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchApi<{ items: ReviewItem[]; summary: ReviewSummary }>(
      `/api/ai/reviews?contractId=${contractVersionId}`
    )
      .then(res => {
        if (!cancelled) {
          setReviews(res.items)
          setSummary(res.summary)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })
  }, [open, contractVersionId])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  // --- Update review (accept / reject) ---

  const updateReview = async (reviewId: string, action: 'accepted' | 'rejected') => {
    setActionLoading(reviewId)
    try {
      await fetchApi(`/api/ai/reviews/${reviewId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: action }),
      })
      // Optimistic update
      setReviews(prev =>
        prev.map(r => (r.id === reviewId ? { ...r, status: action as ReviewItem['status'] } : r))
      )
      setSummary(prev => ({
        ...prev,
        [action]: prev[action] + 1,
        pending: prev.pending - 1,
      }))
    } catch (err) {
      setError((err as Error).message)
    }
    setActionLoading(null)
  }

  const pendingCount = summary.pending + summary.flagged
  const changeCount = reviews.filter(r => r.proposedChange && r.proposedChange.length > 0).length

  // --- Render ---

  if (!open) return null

  return (
    <aside className="flex h-screen w-[720px] flex-col border-l border-slate-200 bg-white shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="size-4 text-blue-500" />
          <span className="font-semibold text-slate-900">Redline Review</span>
          <Badge variant="secondary" className="ml-1">
            {contractVersionId}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onToggle}>
          <CloseIcon className="size-4" />
        </Button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
        <SummaryChip label="Total" value={summary.total} />
        <SummaryChip label="Accepted" value={summary.accepted} variant="default" />
        <SummaryChip label="Rejected" value={summary.rejected} variant="destructive" />
        <SummaryChip label="Pending" value={pendingCount} variant="outline" />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 px-4">
        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as ReviewTab)}>
          <TabsList className="h-9">
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="changes">Changes</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
            <button className="ml-2 underline hover:no-underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* ===== REVIEW TAB ===== */}
        <TabsContent value="review" className="mt-0">
          {loading ? (
            <LoadingState variant="block">Loading reviews…</LoadingState>
          ) : reviews.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon>
                <GitCompareArrows className="size-5" />
              </EmptyStateIcon>
              <EmptyStateTitle>No reviews found</EmptyStateTitle>
              <EmptyStateDescription>
                No review items for this contract version.
              </EmptyStateDescription>
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {reviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onAccept={() => updateReview(review.id, 'accepted')}
                  onReject={() => updateReview(review.id, 'rejected')}
                  actionLoading={actionLoading === review.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== CHANGES TAB ===== */}
        <TabsContent value="changes" className="mt-0">
          {loading ? (
            <LoadingState variant="block">Loading changes…</LoadingState>
          ) : changeCount === 0 ? (
            <EmptyState>
              <EmptyStateIcon>
                <History className="size-5" />
              </EmptyStateIcon>
              <EmptyStateTitle>No changes tracked</EmptyStateTitle>
              <EmptyStateDescription>
                Changes will appear here as they are proposed.
              </EmptyStateDescription>
            </EmptyState>
          ) : (
            <div className="overflow-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Clause</TableHead>
                    <TableHead>Original</TableHead>
                    <TableHead>Proposed</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews
                    .filter(r => r.proposedChange && r.proposedChange.length > 0)
                    .map(review => (
                      <TableRow key={review.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {review.clauseNumber || '—'}
                        </TableCell>
                        <TableCell>
                          <p className="line-through text-xs text-muted-foreground max-w-[200px] truncate">
                            {review.originalText}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-emerald-700 max-w-[200px] truncate">
                            {review.proposedChange}
                          </p>
                        </TableCell>
                        <TableCell>
                          <MiniBadge variant={statusBadgeVariant(review.status)}>
                            {review.status}
                          </MiniBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ===== HISTORY TAB ===== */}
        <TabsContent value="history" className="mt-0">
          {loading ? (
            <LoadingState variant="block">Loading history…</LoadingState>
          ) : (
            <div className="space-y-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-blue-100">
                      <History className="size-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Review session started</p>
                      <p className="text-xs text-muted-foreground">
                        Contract version {contractVersionId} loaded
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {reviews.map(review => (
                <Card key={`h-${review.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100">
                        <Eye className="size-3 text-slate-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">
                          <span className="font-medium">Clause {review.clauseNumber || '—'}</span>
                          {' '}— status set to{' '}
                          <MiniBadge variant={statusBadgeVariant(review.status)}>
                            {review.status}
                          </MiniBadge>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(review.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryChip({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-white px-2 py-1 border border-slate-100 shadow-sm">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${
        variant === 'destructive' ? 'text-red-600' :
        variant === 'default' ? 'text-green-600' :
        'text-slate-900'
      }`}>
        {value}
      </span>
    </div>
  )
}

function ReviewCard({
  review,
  onAccept,
  onReject,
  actionLoading,
}: {
  review: ReviewItem
  onAccept: () => void
  onReject: () => void
  actionLoading: boolean
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        {/* Top row: clause + category + status */}
        <div className="flex items-center gap-2 mb-2">
          {review.clauseNumber && (
            <span className="text-xs font-mono text-muted-foreground">
              {review.clauseNumber}
            </span>
          )}
          {review.category && (
            <Badge variant="outline" className="text-[10px]">
              {review.category}
            </Badge>
          )}
          <MiniBadge variant={statusBadgeVariant(review.status)}>
            {review.status}
          </MiniBadge>
        </div>

        {/* Original text */}
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">Original</p>
          <p className="text-sm text-slate-700 line-through opacity-70">{review.originalText}</p>
        </div>

        {/* Proposed change */}
        {review.proposedChange && (
          <div className="mb-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">Proposed Change</p>
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded px-2 py-1">{review.proposedChange}</p>
          </div>
        )}

        {/* Action buttons */}
        {review.status === 'pending' && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <Button size="sm" variant="default" onClick={onAccept} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              Accept
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="size-3 animate-spin" /> : <CloseIcon className="size-3" />}
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
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

// Re-export EmptyState sub-components for callers
export { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription }

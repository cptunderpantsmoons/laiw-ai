import { useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { fetchApi } from '../api'
import { Contract } from '../types'
import {
  Card,
  CardContent,
  Button,
  LoadingState,
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  FileText,
  Folder,
  Trash2,
  Loader2,
  Upload,
  Plus,
  Eye,
  Send,
  MessageSquare,
  Sparkles,
  AlertCircle,
  History,
  Check,
  X,
  GitCompareArrows,
  Pencil,
} from '@teamsuzie/ui'
import { useState, useEffect } from 'react'
import ChatPanel from '../components/ChatPanel'
import KBSearchPanel from '../components/KBSearchPanel'

// ============================================================================
// Local types
// ============================================================================

interface ContractVersion {
  id: string
  contractId: string
  version: number
  title: string
  content: string
  changes: string
  createdAt: string
  createdBy: string
}

interface RedlineItem {
  id: string
  clauseNumber?: string
  originalText: string
  proposedChange: string
  status: 'pending' | 'accepted' | 'rejected' | 'flagged'
  category?: string
  updatedAt: string
}

interface RedlineSummary {
  total: number
  accepted: number
  rejected: number
  pending: number
  flagged: number
}

interface DocSummary {
  id: string
  name: string
  mimeType: string
  storageKey: string
  size: number
  uploadedBy: string
  createdAt: string
}

interface ContractDetail extends Contract {
  autoRenew?: boolean
  currency?: string
  contractValue?: number
  members?: { id: string; name: string; role: string }[]
}

type TabKey = 'overview' | 'versions' | 'redlines' | 'documents' | 'ai-review'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'versions', label: 'Versions' },
  { key: 'redlines', label: 'Redlines' },
  { key: 'documents', label: 'Documents' },
  { key: 'ai-review', label: 'AI Review' },
]

// ============================================================================
// Helpers
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    draft: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-red-100 text-red-700',
    terminated: 'bg-gray-100 text-gray-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
    flagged: 'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

function formatCurrency(amount: number | undefined, currency = 'USD') {
  if (amount === undefined) return '-'
  return `${currency === 'USD' ? '$' : currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================================
// Main page
// ============================================================================

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [error, setError] = useState<string | null>(null)
  const [chatPanelOpen, setChatPanelOpen] = useState(false)
  const [kbPanelOpen, setKbPanelOpen] = useState(false)

  // ---- Fetch contract detail ----
  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetchApi<ContractDetail>(`/api/contracts/${id}`)
      .then(res => { if (!cancelled) setContract(res) })
      .catch(_err => {
        if (!cancelled) {
          // Fallback to legacy endpoint
          fetchApi<ContractDetail>(`/contracts/${id}`)
            .then(r => { if (!cancelled) setContract(r) })
            .catch(() => {
              if (!cancelled) setError('Failed to load contract')
            })
        }
      })
    return () => { cancelled = true }
  }, [id])

  const handleMatterClick = () => {
    if (contract?.matterId) {
      navigate(`/matters/${contract.matterId}`)
    }
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="size-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-700 font-medium">Error loading contract</p>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading contract...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 overflow-auto flex flex-col">
        {/* Page header */}
        <div className="flex-none bg-white border-b border-slate-200 px-6 pt-6 pb-4 space-y-3">
          {/* Breadcrumb + title */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/contracts" className="hover:text-slate-700 transition-colors">Contracts</Link>
            <span>/</span>
            <span className="text-slate-900 font-medium truncate">{contract.title}</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{contract.title}</h1>
            <StatusBadge status={contract.status} />

            <button
              onClick={() => setChatPanelOpen(true)}
              className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              <Sparkles className="size-3.5" />
              AI Chat
            </button>

            <button
              onClick={() => setKbPanelOpen(true)}
              className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <Eye className="size-3.5" />
              KB Search
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex-none border-b border-slate-200 bg-white">
          <div className="px-6 flex gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
          {activeTab === 'overview' && (
            <OverviewTab contract={contract} onMatterClick={handleMatterClick} />
          )}
          {activeTab === 'versions' && (
            <VersionsTab contractId={id || ''} />
          )}
          {activeTab === 'redlines' && (
            <RedlinesTab contractId={id || ''} />
          )}
          {activeTab === 'documents' && (
            <ContractDocumentsTab contractId={id || ''} />
          )}
          {activeTab === 'ai-review' && (
            <AIReviewTab contract={contract} />
          )}
        </div>
      </div>

      {/* AI Side Panels */}
      <ChatPanel matterId={id || ''} open={chatPanelOpen} onToggle={() => setChatPanelOpen(false)} />
      <KBSearchPanel orgId="" matterId={contract.matterId} open={kbPanelOpen} onToggle={() => setKbPanelOpen(false)} />
    </div>
  )
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ contract, onMatterClick }: {
  contract: ContractDetail
  onMatterClick: () => void
}) {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Quick info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DetailCard label="Counterparty" value={contract.counterparty} />
        <DetailCard label="Type" value={contract.contractType || '-'} />
        <DetailCard label="Start" value={contract.startDate ? new Date(contract.startDate).toLocaleDateString() : '-'} />
        <DetailCard label="End" value={contract.endDate ? new Date(contract.endDate).toLocaleDateString() : '-'} />
      </div>

      {/* Financial */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Financial Terms</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <DetailField label="Contract Value" value={formatCurrency(contract.contractValue, contract.currency)} />
            <DetailField
              label="Auto-Renew"
              value={contract.autoRenew ? (
                <span className="text-green-600 font-medium">Enabled</span>
              ) : (
                <span className="text-slate-400">Disabled</span>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Matter link */}
      {contract.matterId && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Linked Matter</h3>
            <button
              onClick={onMatterClick}
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              <svg className="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              Open Matter
            </button>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      {contract.members && contract.members.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Members</h3>
            <div className="space-y-2">
              {contract.members.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                    {m.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{m.name}</span>
                  <span className="text-xs text-slate-500">({m.role})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dates */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Details</h3>
          <DetailField label="Created" value={new Date(contract.createdAt).toLocaleDateString()} />
          <DetailField label="Status" value={<StatusBadge status={contract.status} />} />
        </CardContent>
      </Card>
    </div>
  )
}

function DetailCard({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{value}</p>
      </CardContent>
    </Card>
  )
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-slate-900 mt-0.5">{value}</p>
    </div>
  )
}

// ============================================================================
// VERSIONS TAB
// ============================================================================

function VersionsTab({ contractId }: { contractId: string }) {
  const [versions, setVersions] = useState<ContractVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<ContractVersion[]>(`/api/contracts/${contractId}/versions`)
      .then(res => { if (!cancelled) { setVersions(res); setLoading(false) }})
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) }})
    return () => { cancelled = true }
  }, [contractId])

  const handleNewVersion = async () => {
    try {
      const version = await fetchApi<ContractVersion>(`/api/contracts/${contractId}/versions`, {
        method: 'POST',
        body: JSON.stringify({ version: (versions.length + 1).toString() }),
      })
      setVersions(prev => [version, ...prev])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create version')
    }
  }

  const handleDelete = async (versionId: string) => {
    if (!confirm('Delete this version?')) return
    try {
      await fetchApi(`/api/contracts/${contractId}/versions/${versionId}`, { method: 'DELETE' })
      setVersions(prev => prev.filter(v => v.id !== versionId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  if (loading) return <LoadingState variant="block">Loading versions...</LoadingState>
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
      <AlertCircle className="size-4 shrink-0" />{error}
    </div>
  )

  const sorted = [...versions].sort((a, b) => Number(b.version) - Number(a.version))

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Versions ({sorted.length})</h3>
        <Button size="sm" variant="default" onClick={handleNewVersion}>
          <Plus className="size-3.5" />
          New Version
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon><History className="size-5" /></EmptyStateIcon>
          <EmptyStateTitle>No versions yet</EmptyStateTitle>
          <EmptyStateDescription>Create a new version to start tracking contract revisions.</EmptyStateDescription>
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {sorted.map(v => (
            <div key={v.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                  v{v.version}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{v.title || `Version ${v.version}`}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{new Date(v.createdAt).toLocaleDateString()}</span>
                    {v.changes && (
                      <>
                        <span className="flex items-center gap-0.5"><GitCompareArrows className="size-3" /> Changes tracked</span>
                      </>
                    )}
                  </div>
                  {v.content && (
                    <p className="text-xs text-slate-500 mt-1 truncate max-w-md">{v.content.slice(0, 120)}...</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => alert(`Content preview:\n\n${v.content || '(empty)'}`)}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
                  title="View content"
                >
                  <Eye className="size-4" />
                </button>
                <button
                  onClick={() => handleDelete(v.id)}
                  className="p-1.5 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                  title="Delete version"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// REDLINES TAB
// ============================================================================

function RedlinesTab({ contractId }: { contractId: string }) {
  const [redlines, setRedlines] = useState<RedlineItem[]>([])
  const [summary, setSummary] = useState<RedlineSummary>({ total: 0, accepted: 0, rejected: 0, pending: 0, flagged: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<{ items: RedlineItem[]; summary: RedlineSummary }>(
      `/api/ai/reviews?contractId=${contractId}`
    )
      .then(res => {
        if (!cancelled) { setRedlines(res.items); setSummary(res.summary); setLoading(false) }
      })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) }})
    return () => { cancelled = true }
  }, [contractId])

  const updateReview = async (reviewId: string, action: 'accepted' | 'rejected') => {
    setActionLoading(reviewId)
    try {
      await fetchApi(`/api/ai/reviews/${reviewId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: action }),
      })
      setRedlines(prev => prev.map(r =>
        r.id === reviewId ? { ...r, status: action as RedlineItem['status'] } : r
      ))
      setSummary(prev => ({
        ...prev,
        [action]: prev[action] + 1,
        pending: prev.pending - 1,
      }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update')
    }
    setActionLoading(null)
  }

  const pendingCount = summary.pending + summary.flagged

  if (loading) return <LoadingState variant="block">Loading redlines...</LoadingState>
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
      <AlertCircle className="size-4 shrink-0" />{error}
    </div>
  )

  const statusVariant = (status: string) => {
    if (status === 'accepted') return 'bg-green-100 text-green-700'
    if (status === 'rejected') return 'bg-red-100 text-red-700'
    if (status === 'flagged') return 'bg-orange-100 text-orange-700'
    return 'border border-slate-300 text-slate-600'
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryChip label="Total" value={summary.total} variant="yellow" />
        <SummaryChip label="Accepted" value={summary.accepted} variant="green" />
        <SummaryChip label="Rejected" value={summary.rejected} variant="red" />
        <SummaryChip label="Pending" value={pendingCount} variant="yellow" />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Redline Items ({redlines.length})</h3>
        <Button size="sm" variant="default">
          <Plus className="size-3.5" />
          Add Redline
        </Button>
      </div>

      {redlines.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon><GitCompareArrows className="size-5" /></EmptyStateIcon>
          <EmptyStateTitle>No redlines</EmptyStateTitle>
          <EmptyStateDescription>Proposed changes to this contract will appear here.</EmptyStateDescription>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {redlines.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {r.clauseNumber && (
                    <span className="text-xs font-mono text-slate-500">Clause {r.clauseNumber}</span>
                  )}
                  {r.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 text-slate-600">
                      {r.category}
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusVariant(r.status)}`}>
                    {r.status}
                  </span>
                </div>

                <div className="mb-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5">Original</p>
                  <p className="text-sm text-slate-700 line-through opacity-70">{r.originalText}</p>
                </div>

                {r.proposedChange && (
                  <div className="mb-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5">Proposed Change</p>
                    <p className="text-sm text-emerald-700 bg-emerald-50 rounded px-2 py-1">{r.proposedChange}</p>
                  </div>
                )}

                {r.status === 'pending' && (
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => updateReview(r.id, 'accepted')}
                      disabled={actionLoading === r.id}
                      className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === r.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                      Accept
                    </button>
                    <button
                      onClick={() => updateReview(r.id, 'rejected')}
                      disabled={actionLoading === r.id}
                      className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === r.id ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                      Reject
                    </button>
                    <button className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors">
                      <Pencil className="size-3" />
                      Modify
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryChip({ label, value, variant }: { label: string; value: number; variant: 'green' | 'red' | 'yellow' }) {
  const cls: Record<string, string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-slate-900',
  }
  return (
    <div className="flex items-center gap-2 rounded-md bg-white px-2 py-1 border border-slate-100 shadow-sm">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-sm font-bold ${cls[variant]}`}>{value}</span>
    </div>
  )
}

// ============================================================================
// CONTRACT DOCUMENTS TAB
// ============================================================================

function ContractDocumentsTab({ contractId }: { contractId: string }) {
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const docsFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<DocSummary[]>(`/api/contracts/${contractId}/documents`)
      .then(res => { if (!cancelled) { setDocs(res); setLoading(false) }})
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) }})
    return () => { cancelled = true }
  }, [contractId])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('contractId', contractId)

      const token = localStorage.getItem('laiw-token')
      const res = await fetch(`/api/contracts/${contractId}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const saved = await res.json() as DocSummary
      setDocs(prev => [saved, ...prev])
      setShowUpload(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document?')) return
    try {
      await fetchApi(`/api/contracts/${contractId}/documents/${docId}`, { method: 'DELETE' })
      setDocs(prev => prev.filter(d => d.id !== docId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  if (loading) return <LoadingState variant="block">Loading documents...</LoadingState>
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
      <AlertCircle className="size-4 shrink-0" />{error}
    </div>
  )

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Documents ({docs.length})</h3>
        <Button size="sm" variant="default" onClick={() => setShowUpload(!showUpload)} disabled={uploading}>
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Upload
        </Button>
      </div>

      {showUpload && (
        <Card className="border-dashed border-2">
          <CardContent className="p-5">
            <input
              ref={docsFileRef}
              type="file"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
            />
            <div className="text-center py-4">
              <p className="text-sm text-slate-600 mb-2">Select a file to upload</p>
              <Button size="sm" onClick={() => docsFileRef.current?.click()}>Choose File</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {docs.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon><Folder className="size-5" /></EmptyStateIcon>
          <EmptyStateTitle>No documents</EmptyStateTitle>
          <EmptyStateDescription>Upload contract documents to this contract.</EmptyStateDescription>
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="size-5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{doc.mimeType?.split('/')[1]?.toUpperCase() || 'File'}</span>
                    <span>{humanSize(doc.size)}</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => alert(`Preview: storageKey = ${doc.storageKey}`)}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                  title="Preview"
                >
                  <Eye className="size-4" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// AI REVIEW TAB
// ============================================================================

function AIReviewTab({ contract }: { contract: ContractDetail }) {
  const [messages, setMessages] = useState<{ id: string; role: string; content: string; createdAt: string }[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchApi<{ id: string }>(`/api/contracts/${contract.id}/ai-chat`)
      .then(res => setChatId(res.id))
      .catch(() => fetchApi<{ id: string }>(`/api/contracts/${contract.id}/ai-chat`, { method: 'POST' })
        .then(r => setChatId(r.id))
        .catch(() => {}))
  }, [contract.id])

  useEffect(() => {
    if (!chatId) return
    let cancelled = false
    fetchApi<{ id: string; role: string; content: string; createdAt: string }[]>(`/api/contracts/${contract.id}/chat`)
      .then(res => { if (!cancelled) setMessages(res) })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [chatId, contract.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (msg: string) => {
    const trimmed = msg.trim()
    if (!trimmed || streaming || !chatId) return

    const userMsg = { id: `tmp-${Date.now()}`, role: 'user', content: trimmed, createdAt: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setError(null)

    const placeholderId = `tmp-assistant-${Date.now()}`
    setMessages(prev => [...prev, { id: placeholderId, role: 'assistant', content: '', createdAt: new Date().toISOString() }])

    try {
      const res = await fetch(`/api/ai/chats/${chatId}/messages/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      if (res.ok && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let partial = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              partial += data
              setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: partial } : m))
            }
          }
        }
      } else {
        const data = await fetchApi<{ content: string }>(`/api/ai/chats/${chatId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ message: trimmed }),
        })
        setMessages(prev => prev.map(m =>
          m.id === placeholderId ? { ...m, content: data.content, createdAt: new Date().toISOString() } : m
        ))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
      setMessages(prev => prev.map(m =>
        m.id === placeholderId ? { ...m, content: 'Sorry, I encountered an error.' } : m
      ))
    }
    setStreaming(false)
  }

  const quickActions = [
    { label: 'Summarize contract', action: 'Summarize this contract' },
    { label: 'Flag risky clauses', action: 'Analyze this contract and flag any risky or unusual clauses' },
    { label: 'Compare to previous version', action: 'Compare this version to the previous version' },
  ]

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {quickActions.map(qa => (
          <button
            key={qa.label}
            onClick={() => sendMessage(qa.action)}
            disabled={streaming}
            className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            <Sparkles className="size-3" />
            {qa.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-white rounded-lg border border-slate-200">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />{error}
          </div>
        )}

        {!chatId && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <MessageSquare className="size-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Connecting to AI...</p>
          </div>
        )}

        {messages.length === 0 && chatId && !error && (
          <EmptyState className="py-12">
            <EmptyStateIcon><MessageSquare className="size-5" /></EmptyStateIcon>
            <EmptyStateTitle>Start an AI review</EmptyStateTitle>
            <EmptyStateDescription>Ask the AI to analyze this contract. Use the quick actions above to get started.</EmptyStateDescription>
          </EmptyState>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-50 border border-slate-200 text-slate-900'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="size-3 text-amber-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">AI</span>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap break-words">
                {msg.content || (msg.role === 'assistant' && streaming ? 'Thinking...' : '')}
              </p>
              <p className="text-[10px] mt-1.5 text-slate-400">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-500">
              <Loader2 className="size-3.5 animate-spin" />
              AI is thinking...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 mt-4">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage(input)
            }
          }}
          placeholder="Ask the AI to review this contract..."
          className="flex-1 resize-none border border-slate-300 bg-white px-3 py-2 text-sm rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          rows={2}
          style={{ maxHeight: '160px' }}
          disabled={streaming}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={streaming || !input.trim()}
          className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors shrink-0"
        >
          {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </div>
  )
}

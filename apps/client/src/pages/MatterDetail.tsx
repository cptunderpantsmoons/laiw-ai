import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { fetchApi } from '../api'
import { MatterDetail as MatterDetailType, Budget, Task } from '../types'
import ChatPanel from '../components/ChatPanel'
import KBSearchPanel from '../components/KBSearchPanel'
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
} from '@teamsuzie/ui'

// ============================================================================
// Local augmented types for the detail views
// ============================================================================

interface MatterDoc {
  id: string
  name: string
  mimeType: string
  storageKey: string
  size: number
  uploadedBy: string
  createdAt: string
}

interface ContractSummary {
  id: string
  title: string
  counterparty: string
  contractType: string
  status: string
  startDate: string
  endDate: string
  contractValue?: number
  currency?: string
  matterId: string
}

interface SpendTransaction {
  id: string
  type: string
  vendorName: string
  invoiceRef: string
  amount: number
  currency: string
  status: string
  notes: string
  createdAt: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface AutoIndexResult {
  success: boolean
  indexedCount: number
  error?: string
}

interface TriageResult {
  suggestedMatterType: string
  suggestedMatterTitle: string
  priority: string
  prefill: Record<string, string>
  confidence: number
}

type TabKey = 'overview' | 'documents' | 'contracts' | 'spend' | 'tasks' | 'chat'

// ============================================================================
// Status badge helper
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    open: 'bg-green-100 text-green-700',
    'on-hold': 'bg-yellow-100 text-yellow-700',
    closed: 'bg-gray-100 text-gray-700',
    archived: 'bg-slate-100 text-slate-600',
    active: 'bg-green-100 text-green-700',
    draft: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-red-100 text-red-700',
    terminated: 'bg-gray-100 text-gray-700',
    done: 'bg-green-100 text-green-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    blocked: 'bg-red-100 text-red-700',
    todo: 'bg-gray-100 text-gray-700',
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    DONE: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls: Record<string, string> = {
    HIGH: 'text-orange-600',
    URGENT: 'text-red-600 font-bold',
    MEDIUM: 'text-blue-600',
    LOW: 'text-slate-500',
  }
  return <span className={`text-xs font-medium ${cls[priority] || ''}`}>{priority}</span>
}

function formatCurrency(amount: number, currency = 'USD') {
  return `${currency === 'USD' ? '$' : currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================================
// Main page component
// ============================================================================

export default function MatterDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [matter, setMatter] = useState<MatterDetailType | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [chatPanelOpen, setChatPanelOpen] = useState(false)
  const [kbPanelOpen, setKbPanelOpen] = useState(false)
  const [triageLoading, setTriageLoading] = useState(false)

  // ---- Fetch matter details ----
  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetchApi<MatterDetailType>(`/api/matters/${id}`)
      .then(res => {
        if (!cancelled) setMatter(res)
      })
      .catch(() => {
        // Fallback to legacy endpoint
        if (!cancelled) {
          fetchApi<MatterDetailType>(`/matters/${id}`)
            .then(r => { if (!cancelled) setMatter(r) })
            .catch(() => { if (!cancelled) setMatter(null) })
        }
      })
    return () => { cancelled = true }
  }, [id])

  // ---- Auto-index documents into knowledge base on mount ----
  useEffect(() => {
    fetchApi<AutoIndexResult>(`/api/matter-auto/index-context`, {
      method: 'POST',
      body: JSON.stringify({ matterId: id }),
    }).catch(() => {
      // Non-critical — auto-indexing may not be set up
    })
  }, [id])

  // ---- AI Triage handler ----
  const handleTriage = async () => {
    if (!id || triageLoading) return
    setTriageLoading(true)
    try {
      const result = await fetchApi<TriageResult>(`/api/matter-auto/triage-and-create`, {
        method: 'POST',
        body: JSON.stringify({ matterId: id }),
      })
      // Triage result consumed for side-effects; result logged for debugging
      console.log('Triage result:', result)
    } catch {
      // Ignore — may not have intake linked
    } finally {
      setTriageLoading(false)
    }
  }

  // ---- Contract click navigates to ContractDetail ----
  const handleContractClick = (contractId: string) => {
    navigate(`/contracts/${contractId}`)
  }

  if (!matter) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading matter...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { key: 'overview' as TabKey, label: 'Overview' },
    { key: 'documents' as TabKey, label: 'Documents' },
    { key: 'contracts' as TabKey, label: 'Contracts' },
    { key: 'spend' as TabKey, label: 'Spend' },
    { key: 'tasks' as TabKey, label: 'Tasks' },
    { key: 'chat' as TabKey, label: 'Chat' },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 overflow-auto flex flex-col">
        {/* Page header */}
        <div className="flex-none bg-white border-b border-slate-200 px-6 pt-6 pb-4 space-y-3">
          {/* Breadcrumb + title */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/matters" className="hover:text-slate-700 transition-colors">Matters</Link>
            <span>/</span>
            <span className="text-slate-900 font-medium truncate">{matter.name}</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{matter.name}</h1>
            <StatusBadge status={matter.status} />

            {/* AI buttons */}
            <button
              onClick={handleTriage}
              disabled={triageLoading}
              className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {triageLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {triageLoading ? 'Triage...' : 'AI Triage'}
            </button>

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

            <Link
              to={`/audit/${id}`}
              className="flex items-center gap-1.5 bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
            >
              <History className="size-3.5" />
              Audit Log
            </Link>
          </div>
        </div>

        {/* Sub-tabs navigation */}
        <div className="flex-none border-b border-slate-200 bg-white">
          <div className="px-6 flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
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

        {/* Tab content — each loads independently */}
        <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
          {activeTab === 'overview' && (
            <OverviewTab matter={matter} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab matterId={id || ''} />
          )}
          {activeTab === 'contracts' && (
            <ContractsTab matterId={id || ''} onContractClick={handleContractClick} />
          )}
          {activeTab === 'spend' && (
            <SpendTab matterId={id || ''} />
          )}
          {activeTab === 'tasks' && (
            <TasksTab matterId={id || ''} />
          )}
          {activeTab === 'chat' && (
            <ChatTab matterId={id || ''} />
          )}
        </div>
      </div>

      {/* AI Side Panels */}
      <ChatPanel matterId={id || ''} open={chatPanelOpen} onToggle={() => setChatPanelOpen(false)} />
      <KBSearchPanel orgId="" matterId={id} open={kbPanelOpen} onToggle={() => setKbPanelOpen(false)} />
    </div>
  )
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ matter }: { matter: MatterDetailType }) {
  const [contracts, setContracts] = useState<ContractSummary[]>([])
  const [transactions, setTransactions] = useState<SpendTransaction[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [budget, setBudget] = useState<Budget | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      try {
        const [contractsRes, transactionsRes, tasksRes, budgetRes] = await Promise.all([
          fetchApi<ContractSummary[]>(`/api/matters/${matter.id}/contracts`).catch(() => [] as ContractSummary[]),
          fetchApi<SpendTransaction[]>(`/api/matters/${matter.id}/spend`).catch(() => [] as SpendTransaction[]),
          fetchApi<Task[]>(`/api/matters/${matter.id}/tasks`).catch(() => [] as Task[]),
          fetchApi<Budget[]>(`/spend/budgets`).catch(() => [] as Budget[]),
        ])
        if (!cancelled) {
          setContracts(contractsRes)
          setTransactions(transactionsRes)
          setTasks(tasksRes)
          const matterBudget = budgetRes.find(b => b.matterId === matter.id)
          if (matterBudget) setBudget(matterBudget)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [matter.id])

  // Activity feed: merged from chat-related + spend + tasks
  const activities = [
    ...transactions.slice(0, 3).map(tx => ({
      description: `Spent ${formatCurrency(tx.amount)} to ${tx.vendorName}`,
      timestamp: tx.createdAt,
      type: 'spend',
    })),
    ...tasks.slice(0, 2).map(t => ({
      description: `${t.status.toLowerCase().replace(/_/g, ' ')}: ${t.title}`,
      timestamp: t.createdAt,
      type: 'task',
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="space-y-6 max-w-5xl">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Documents" value={String(matter.documents || 0)} icon={<Folder className="size-4 text-blue-500" />} />
        <KpiCard label="Contracts" value={String(contracts.length)} icon={<FileText className="size-4 text-emerald-500" />} />
        <KpiCard
          label="Total Spend"
          value={formatCurrency(budget?.spent || transactions.reduce((s, t) => s + t.amount, 0))}
          icon={<span className="size-4 text-amber-500">💰</span>}
        />
        <KpiCard label="Active Tasks" value={String(tasks.filter(t => t.status !== 'DONE').length)} icon={<Check className="size-4 text-violet-500" />} />
      </div>

      {/* Budget bar (if budget exists) */}
      {budget && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Budget Utilization</h3>
              <span className="text-sm text-slate-500">
                {budget.totalAmount > 0 ? Math.round((budget.spent / budget.totalAmount) * 100) : 0}% used
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 mb-3">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  budget.totalAmount > 0 && budget.spent > budget.totalAmount ? 'bg-red-500' : 'bg-primary-600'
                }`}
                style={{ width: `${budget.totalAmount > 0 ? Math.min((budget.spent / budget.totalAmount) * 100, 100) : 0}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-slate-500">Total</p>
                <p className="font-semibold text-slate-900">{formatCurrency(budget.totalAmount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Spent</p>
                <p className="font-semibold text-slate-900">{formatCurrency(budget.spent)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">Remaining</p>
                <p className={`font-semibold ${budget.remaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatCurrency(Math.max(budget.remaining, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          <p className="font-medium">Error loading detail data</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Matter metadata */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Matter Details</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <DetailField label="Type" value={matter.type || '-'} />
            <DetailField label="Status" value={<StatusBadge status={matter.status} />} />
            <DetailField label="Created" value={new Date(matter.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
            <DetailField label="Updated" value={new Date(matter.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
          </div>
          {matter.description && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-slate-600">{matter.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Activity</h3>
          {activities.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon><History className="size-5" /></EmptyStateIcon>
              <EmptyStateTitle>No recent activity</EmptyStateTitle>
              <EmptyStateDescription>Activity from spend, tasks, and messages will appear here.</EmptyStateDescription>
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {activities.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  <span className="text-xs text-slate-400 w-24 shrink-0">
                    {new Date(a.timestamp).toLocaleDateString()}
                  </span>
                  <span className={`size-2 rounded-full shrink-0 ${
                    a.type === 'spend' ? 'bg-amber-400' :
                    a.type === 'task' ? 'bg-violet-400' : 'bg-blue-400'
                  }`} />
                  <span className="text-sm text-slate-700 truncate">{a.description}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
          </div>
          <div className="text-slate-400">{icon}</div>
        </div>
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
// DOCUMENTS TAB
// ============================================================================

function DocumentsTab({ matterId }: { matterId: string }) {
  const [docs, setDocs] = useState<MatterDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const docsFileRef = useRef<HTMLInputElement>(null)

  // Fetch documents
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<MatterDoc[]>(`/api/matters/${matterId}/documents`)
      .then(res => { if (!cancelled) { setDocs(res); setLoading(false) }})
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) }})
    return () => { cancelled = true }
  }, [matterId])

  // Upload handler
  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('matterId', matterId)

      // Upload the file (expects multipart at /api/matters/:id/documents)
      const token = localStorage.getItem('laiw-token')
      const uploadRes = await fetch(`/api/matters/${matterId}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => '')
        throw new Error(text || `Upload failed: ${uploadRes.status}`)
      }
      const savedDoc = await uploadRes.json() as MatterDoc
      setDocs(prev => [savedDoc, ...prev])
      setShowUpload(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Delete handler
  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document?')) return
    try {
      await fetchApi(`/api/matters/${matterId}/documents/${docId}`, { method: 'DELETE' })
      setDocs(prev => prev.filter(d => d.id !== docId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  // Auto-index after upload
  const handleIndexAfterUpload = () => {
    fetchApi(`/api/matter-auto/index-context`, {
      method: 'POST',
      body: JSON.stringify({ matterId }),
    }).catch(() => {})
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Documents ({docs.length})
        </h3>
        <Button size="sm" variant="default" onClick={() => setShowUpload(!showUpload)} disabled={uploading}>
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {uploading ? 'Uploading...' : 'Upload Document'}
        </Button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <Card className="border-dashed border-2">
          <CardContent className="p-5">
            <input
              ref={docsFileRef}
              type="file"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) {
                  handleUpload(f)
                  handleIndexAfterUpload()
                }
              }}
            />
            <div className="text-center py-4">
              <p className="text-sm text-slate-600 mb-2">Select a file to upload to this matter</p>
              <Button size="sm" onClick={() => docsFileRef.current?.click()}>
                Choose File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <LoadingState variant="block">Loading documents...</LoadingState>
      ) : docs.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon><Folder className="size-5" /></EmptyStateIcon>
          <EmptyStateTitle>No documents yet</EmptyStateTitle>
          <EmptyStateDescription>Upload a document to get started. It will be automatically indexed for AI search.</EmptyStateDescription>
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
                  onClick={() => {
                    // Preview: open in new tab with storageKey info
                    alert(`Preview: storageKey = ${doc.storageKey}\n\nIn production, this would open a file viewer.`)
                  }}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
                  title="Preview"
                >
                  <Eye className="size-4" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
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
// CONTRACTS TAB
// ============================================================================

function ContractsTab({ matterId, onContractClick }: { matterId: string; onContractClick: (id: string) => void }) {
  const [contracts, setContracts] = useState<ContractSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<ContractSummary[]>(`/api/matters/${matterId}/contracts`)
      .then(res => { if (!cancelled) { setContracts(res); setLoading(false) }})
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) }})
    return () => { cancelled = true }
  }, [matterId])

  if (loading) return <LoadingState variant="block">Loading contracts...</LoadingState>
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
      <AlertCircle className="size-4 shrink-0" />{error}
    </div>
  )
  if (contracts.length === 0) return (
    <EmptyState>
      <EmptyStateIcon><FileText className="size-5" /></EmptyStateIcon>
      <EmptyStateTitle>No contracts</EmptyStateTitle>
      <EmptyStateDescription>Contracts linked to this matter will appear here. Click the New Contract button to create one.</EmptyStateDescription>
    </EmptyState>
  )

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Contracts ({contracts.length})</h3>
        <Link to="/contracts">
          <Button size="sm" variant="default">
            <Plus className="size-3.5" />
            New Contract
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contracts.map(c => (
          <ContractCard key={c.id} contract={c} onClick={() => onContractClick(c.id)} />
        ))}
      </div>
    </div>
  )
}

function ContractCard({ contract, onClick }: { contract: ContractSummary; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-primary-300 transition-colors" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-900 truncate pr-2">{contract.title}</h4>
          <StatusBadge status={contract.status} />
        </div>
        <p className="text-xs text-slate-500 mb-3">{contract.counterparty}</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-slate-500">Type</p>
            <p className="font-medium text-slate-800">{contract.contractType || '-'}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Value</p>
            <p className="font-medium text-slate-800">{contract.contractValue ? formatCurrency(contract.contractValue, contract.currency) : '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Start</p>
            <p className="font-medium text-slate-800">{contract.startDate ? new Date(contract.startDate).toLocaleDateString() : '-'}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">End</p>
            <p className="font-medium text-slate-800">{contract.endDate ? new Date(contract.endDate).toLocaleDateString() : '-'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// SPEND TAB
// ============================================================================

function SpendTab({ matterId }: { matterId: string }) {
  const [transactions, setTransactions] = useState<SpendTransaction[]>([])
  const [budget, setBudget] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [vendorName, setVendorName] = useState('')
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [status, setStatus] = useState('pending')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchApi<SpendTransaction[]>(`/api/matters/${matterId}/spend`).catch(() => [] as SpendTransaction[]),
      fetchApi<Budget[]>(`/spend/budgets`).catch(() => [] as Budget[]),
    ])
      .then(([txRes, budgetRes]) => {
        if (!cancelled) {
          setTransactions(txRes)
          const matBudget = budgetRes.find(b => b.matterId === matterId)
          if (matBudget) setBudget(matBudget)
          setLoading(false)
        }
      })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) }})
    return () => { cancelled = true }
  }, [matterId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || !vendorName.trim()) return
    setSubmitting(true)
    try {
      const tx = await fetchApi<SpendTransaction>(`/api/matters/${matterId}/spend`, {
        method: 'POST',
        body: JSON.stringify({
          matterId,
          type,
          vendorName: vendorName.trim(),
          amount: amt,
          currency,
          status,
          notes: notes.trim() || undefined,
        }),
      })
      setTransactions(prev => [tx, ...prev])
      setVendorName('')
      setAmount('')
      setNotes('')
      setShowForm(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add transaction')
    } finally {
      setSubmitting(false)
    }
  }

  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0)
  const budgetPct = budget && budget.totalAmount > 0 ? Math.round((totalSpent / budget.totalAmount) * 100) : 0

  if (loading) return <LoadingState variant="block">Loading spend data...</LoadingState>
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
      <AlertCircle className="size-4 shrink-0" />{error}
    </div>
  )

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total Spent</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
        {budget && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Budget</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(budget.totalAmount)}</p>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                <div
                  className={`h-1.5 rounded-full ${budgetPct > 100 ? 'bg-red-500' : 'bg-primary-600'}`}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{budgetPct}% used</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Transactions</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{transactions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Transaction */}
      <div className="flex justify-end">
        <Button size="sm" variant="default" onClick={() => setShowForm(!showForm)}>
          <Plus className="size-3.5" />
          Add Transaction
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-5">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vendor Name *</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={e => setVendorName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Vendor name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <input
                    type="text"
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g. expense, retainer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="approved">Approved</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Optional notes"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  {submitting ? 'Adding...' : 'Add Transaction'}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Transaction Table */}
      {transactions.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon><span className="text-slate-400 text-2xl">💰</span></EmptyStateIcon>
          <EmptyStateTitle>No transactions</EmptyStateTitle>
          <EmptyStateDescription>Add a transaction to track spend for this matter.</EmptyStateDescription>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Vendor</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Type</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Amount</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{tx.vendorName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{tx.type}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-slate-900">
                        {formatCurrency(tx.amount, tx.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// TASKS TAB
// ============================================================================

function TasksTab({ matterId }: { matterId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [status, setStatus] = useState<'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'>('PENDING')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<Task[]>(`/api/matters/${matterId}/tasks`)
      .then(res => { if (!cancelled) { setTasks(res); setLoading(false) }})
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) }})
    return () => { cancelled = true }
  }, [matterId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const task = await fetchApi<Task>(`/api/matters/${matterId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          status,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          assigneeId: assigneeId || undefined,
        }),
      })
      setTasks(prev => [task, ...prev])
      setTitle('')
      setDescription('')
      setDueDate('')
      setAssigneeId('')
      setShowForm(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add task')
    } finally {
      setSubmitting(false)
    }
  }

  const quickUpdateStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      await fetchApi<Task>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task?')) return
    try {
      await fetchApi(`/api/tasks/${taskId}`, { method: 'DELETE' })
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  if (loading) return <LoadingState variant="block">Loading tasks...</LoadingState>
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
      <AlertCircle className="size-4 shrink-0" />{error}
    </div>
  )

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Tasks ({tasks.length})</h3>
        <Button size="sm" variant="default" onClick={() => setShowForm(!showForm)}>
          <Plus className="size-3.5" />
          Add Task
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-5">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Task title"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Assignee ID</label>
                  <input
                    type="text"
                    value={assigneeId}
                    onChange={e => setAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="User UUID"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Task description"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as Task['priority'])}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as Task['status'])}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  {submitting ? 'Creating...' : 'Create Task'}
                </Button>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-100 font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon><Check className="size-5" /></EmptyStateIcon>
          <EmptyStateTitle>No tasks</EmptyStateTitle>
          <EmptyStateDescription>Create a task to track action items for this matter.</EmptyStateDescription>
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={`size-2.5 rounded-full shrink-0 ${
                  task.status === 'DONE' ? 'bg-green-400' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-400' :
                  task.status === 'CANCELLED' ? 'bg-slate-400' :
                  'bg-amber-400'
                }`} />
                <div className="min-w-0">
                  <p className={`text-sm truncate ${task.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-900 font-medium'}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-slate-500 truncate">{task.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 ml-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-500 uppercase">Status</span>
                  <select
                    value={task.status}
                    onChange={e => quickUpdateStatus(task.id, e.target.value as Task['status'])}
                    className="text-xs px-2 py-0.5 rounded border-0 bg-slate-100 cursor-pointer focus:ring-2 focus:ring-primary-500"
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <PriorityBadge priority={task.priority} />
                {task.dueDate && (
                  <span className="text-xs text-slate-500 w-20 text-right">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Delete task"
                >
                  <X className="size-3.5" />
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
// CHAT TAB
// ============================================================================

function ChatTab({ matterId }: { matterId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // Initialize chat
  useEffect(() => {
    let cancelled = false
    // Try to find existing chat
    fetchApi<{ id: string }>(`/api/matters/${matterId}/ai-chat`)
      .then(res => { if (!cancelled) setChatId(res.id) })
      .catch(() => {
        // Create new chat
        fetchApi<{ id: string }>(`/api/matters/${matterId}/ai-chat`, { method: 'POST' })
          .then(r => { if (!cancelled) setChatId(r.id) })
          .catch(() => {})
      })
    return () => { cancelled = true }
  }, [matterId])

  // Load messages when chatId arrives
  useEffect(() => {
    if (!chatId) return
    let cancelled = false
    fetchApi<ChatMessage[]>(`/api/matters/${matterId}/chat`)
      .then(res => { if (!cancelled) setMessages(res) })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [chatId, matterId])

  // Scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || streaming || !chatId) return

    const userMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setError(null)

    // Placeholder assistant
    const placeholderId = `tmp-assistant-${Date.now()}`
    setMessages(prev => [...prev, { id: placeholderId, role: 'assistant', content: '', createdAt: new Date().toISOString() }])

    try {
      // Try streaming
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
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              partial += data
              setMessages(prev => prev.map(m =>
                m.id === placeholderId ? { ...m, content: partial } : m
              ))
            }
          }
        }
      } else {
        // Fallback to non-streaming
        const data = await fetchApi<{ content: string }>(`/api/ai/chats/${chatId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ message: trimmed }),
        })
        setMessages(prev => prev.map(m =>
          m.id === placeholderId ? { ...m, content: data.content, createdAt: new Date().toISOString() } : m
        ))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      setMessages(prev => prev.map(m =>
        m.id === placeholderId ? { ...m, content: 'Sorry, I encountered an error. Please try again.' } : m
      ))
    }

    setStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-6">
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
            <EmptyStateTitle>No messages yet</EmptyStateTitle>
            <EmptyStateDescription>Ask the AI assistant anything about this matter.</EmptyStateDescription>
          </EmptyState>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-slate-200 text-slate-900'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="size-3 text-amber-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">AI</span>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap break-words">{msg.content || (msg.role === 'assistant' && streaming ? 'Thinking...' : '')}</p>
              <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>
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
      <div className="flex-none border-t border-slate-200 bg-white px-6 py-4">
        <div className="flex items-end gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-200">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this matter..."
            className="flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm focus-visible:ring-0 focus:outline-none"
            rows={1}
            style={{ height: '36px', maxHeight: '160px' }}
            disabled={streaming}
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="p-1.5 rounded-md text-primary-600 disabled:opacity-40 hover:bg-primary-50 transition-colors"
          >
            {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

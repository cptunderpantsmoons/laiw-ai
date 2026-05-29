import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchApi } from '../api'
import { Matter, Budget } from '../types'
import {
  Card,
  CardContent,
  Badge,
  Button,
  LoadingState,
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  FileText,
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
} from '@teamsuzie/ui'
import {
  TrendingUp,
  DollarSign,
  Wallet,
  AlertCircle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Recharts
// ---------------------------------------------------------------------------
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SPEND_TYPE_COLORS: Record<string, string> = {
  OUTSIDE_COUNSEL_FEE: '#3b82f6',
  EXPENSE: '#8b5cf6',
  SOFTWARE: '#f59e0b',
  FILING_FEE: '#ec4899',
  OTHER: '#64748b',
}

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LocalTransaction {
  id: string
  matterId: string
  type: string
  vendorName: string
  amount: number
  status: string
  date: string
  notes?: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(value: number): string {
  return CURRENCY.format(value)
}

function spendingBadgeColor(pct: number): string {
  if (pct > 100) return 'bg-red-100 text-red-700'
  if (pct > 80) return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  label,
  value,
  subtext,
  icon,
  color,
}: {
  label: string
  value: string
  subtext?: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <Card className="bg-white">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            {subtext && (
              <p className="text-xs text-slate-400">{subtext}</p>
            )}
          </div>
          <div className={`rounded-lg p-2 ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function MatterSpend() {
  const { id } = useParams<{ id: string }>()
  const [matter, setMatter] = useState<Matter | null>(null)
  const [transactions, setTransactions] = useState<LocalTransaction[]>([])
  const [budget, setBudget] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Form fields
  const [vendorName, setVendorName] = useState('')
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [status, setStatus] = useState('pending')
  const [notes, setNotes] = useState('')

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchApi<Matter>(`/api/matters/${id}`),
      fetchApi<LocalTransaction[]>(`/api/matters/${id}/spend`),
      fetchApi<Budget[]>(`/spend/budgets`)
        .then(res => {
          const matBudget = res.find(b => b.matterId === id)
          if (!cancelled && matBudget) setBudget(matBudget)
          return matBudget
        })
        .catch(() => null as Budget | null),
    ])
      .then(([matterRes, txRes]) => {
        if (!cancelled) {
          setMatter(matterRes)
          setTransactions(txRes)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [id])

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------
  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0)
  const remaining = budget ? Math.max(budget.remaining, 0) : 0
  const pctUsed = budget && budget.totalAmount > 0
    ? Math.round((totalSpent / budget.totalAmount) * 100)
    : 0

  // Monthly spend for area chart
  const monthlySpend: Record<string, number> = {}
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7) // YYYY-MM
    monthlySpend[month] = (monthlySpend[month] || 0) + tx.amount
  }
  const monthlySpendData = Object.entries(monthlySpend)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }))

  // Spend by type for bar chart
  const spendByType: Record<string, number> = {}
  for (const tx of transactions) {
    const t = tx.type || 'OTHER'
    spendByType[t] = (spendByType[t] || 0) + tx.amount
  }
  const spendByTypeData = Object.entries(spendByType)
    .map(([name, value]) => ({ name, value }))

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || !vendorName.trim()) return
    setSubmitting(true)
    setFormError(null)
    try {
      const tx = await fetchApi<LocalTransaction>(`/api/matters/${id}/spend`, {
        method: 'POST',
        body: JSON.stringify({
          matterId: id,
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
      setFormError(err instanceof Error ? err.message : 'Failed to add transaction')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (txId: string) => {
    if (!confirm('Delete this transaction?')) return
    try {
      await fetchApi(`/api/spend/${txId}`, { method: 'DELETE' })
      setTransactions(prev => prev.filter(t => t.id !== txId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-6">
        <LoadingState>Loading spend data...</LoadingState>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Error
  // -----------------------------------------------------------------------
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading matter spend</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (!matter) {
    return (
      <div className="p-6">
        <EmptyState>
          <EmptyStateIcon>
            <AlertCircle className="size-5" />
          </EmptyStateIcon>
          <EmptyStateTitle>Matter not found</EmptyStateTitle>
          <EmptyStateDescription>
            The matter you are looking for does not exist.
          </EmptyStateDescription>
        </EmptyState>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/matters/${id}`}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{matter.name}</h1>
            <p className="text-sm text-slate-500">{matter.type}</p>
          </div>
        </div>
        <Link
          to={`/matters/${id}`}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Matter Overview
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Budget"
          value={budget ? formatCurrency(budget.totalAmount) : 'N/A'}
          icon={<Wallet className="size-5" />}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="Total Spent"
          value={formatCurrency(totalSpent)}
          subtext={`${transactions.length} transactions`}
          icon={<TrendingUp className="size-5" />}
          color="bg-amber-50 text-amber-600"
        />
        <KpiCard
          label="Remaining"
          value={budget ? formatCurrency(remaining) : 'N/A'}
          icon={<DollarSign className="size-5" />}
          color="bg-green-50 text-green-600"
        />
        <KpiCard
          label="% Used"
          value={`${pctUsed}%`}
          subtext={pctUsed > 100 ? 'Over budget!' : `${remaining} remaining`}
          icon={
            <span className="text-lg font-bold">
              {pctUsed > 100 ? '⚠️' : pctUsed > 80 ? '🟡' : '🟢'}
            </span>
          }
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Progress bar */}
      {budget && (
        <Card className="bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Budget Utilization</span>
              <Badge
                variant="outline"
                className={spendingBadgeColor(pctUsed)}
              >
                {pctUsed}% used
              </Badge>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  pctUsed > 100 ? 'bg-red-500' : pctUsed > 80 ? 'bg-yellow-500' : 'bg-primary-600'
                }`}
                style={{ width: `${Math.min(pctUsed, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>{formatCurrency(totalSpent)} spent</span>
              <span>{formatCurrency(budget.totalAmount)} budget</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Monthly Spend Trend */}
        <Card className="bg-white">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Monthly Spend Trend</h3>
            {monthlySpendData.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-slate-400">No monthly data yet</p>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlySpendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="monthlySpendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      tickFormatter={(v) => v.slice(5)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v >= 1000 ? `${v / 1000}k` : v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        color: '#f8fafc',
                        borderRadius: 8,
                        fontSize: 13,
                        border: 'none',
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Amount']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#monthlySpendGradient)"
                      name="Amount"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spend by Type */}
        <Card className="bg-white">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Spend by Type</h3>
            {spendByTypeData.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-slate-400">No spend data yet</p>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendByTypeData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v >= 1000 ? `${v / 1000}k` : v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        color: '#f8fafc',
                        borderRadius: 8,
                        fontSize: 13,
                        border: 'none',
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    />
                    <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {spendByTypeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={SPEND_TYPE_COLORS[entry.name] || '#64748b'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction Table + Add Form */}
      <Card className="bg-white">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Transactions ({transactions.length})
            </h3>
            <Button
              size="sm"
              variant="default"
              onClick={() => setShowForm(!showForm)}
            >
              <Plus className="size-3.5" />
              Add Transaction
            </Button>
          </div>

          {/* Add transaction form */}
          {showForm && (
            <div className="mb-5 p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-4">
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Vendor Name *
                    </label>
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
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Type
                    </label>
                    <input
                      type="text"
                      value={type}
                      onChange={e => setType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g. OUTSIDE_COUNSEL_FEE"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Amount *
                    </label>
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
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Currency
                    </label>
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
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Status
                    </label>
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
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Optional notes"
                    rows={2}
                  />
                </div>
                {formError && (
                  <p className="text-sm text-red-600">{formError}</p>
                )}
                <div className="flex gap-3">
                  <Button type="submit" size="sm" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    {submitting ? 'Adding...' : 'Add Transaction'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setFormError(null) }}
                    className="text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-200 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Transaction table */}
          {transactions.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon>
                <FileText className="size-5" />
              </EmptyStateIcon>
              <EmptyStateTitle>No transactions yet</EmptyStateTitle>
              <EmptyStateDescription>
                Add a transaction to track spending for this matter.
              </EmptyStateDescription>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Vendor
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Type
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Amount
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Date
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {tx.vendorName || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {tx.type || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-slate-900">
                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          tx.status === 'paid' ? 'bg-green-100 text-green-700' :
                          tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          tx.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

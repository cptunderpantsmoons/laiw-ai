import { useState, useEffect, useMemo } from 'react'
import { fetchApi } from '../api'
import { Matter, Contract, Task } from '../types'
import {
  Card,
  CardContent,
  Badge,
  LoadingState,
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
} from '@teamsuzie/ui'
import {
  Calendar,
  Clock,
  TrendingUp,
  Users,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Recharts
// ---------------------------------------------------------------------------
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b']

const MATTER_STATUS_COLORS: Record<string, string> = {
  OPEN: '#22c55e',
  IN_PROGRESS: '#3b82f6',
  ON_HOLD: '#f59e0b',
  CLOSED: '#64748b',
}

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(value: number): string {
  return CURRENCY.format(value)
}

function daysAgo(dateStr: string): number {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  } catch {
    return 0
  }
}

function ageBadgeClass(days: number): string {
  if (days <= 30) return 'bg-green-100 text-green-700'
  if (days <= 90) return 'bg-yellow-100 text-yellow-700'
  if (days <= 180) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

function daysUntil(dateStr: string): number {
  try {
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  } catch {
    return 0
  }
}

function expiryBadgeClass(daysLeft: number): string {
  if (daysLeft > 60) return 'bg-green-100 text-green-700'
  if (daysLeft > 30) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

// ---------------------------------------------------------------------------
// Chart wrapper component
// ---------------------------------------------------------------------------
function ChartCard({
  title,
  children,
  isEmpty,
}: {
  title: string
  children: React.ReactNode
  isEmpty?: boolean
}) {
  return (
    <Card className="bg-white">
      <CardContent className="p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">{title}</h3>
        {isEmpty ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-slate-400">No data available</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function CrossMatterReport() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matters, setMatters] = useState<Matter[]>([])
  const [spendTransactions, setSpendTransactions] = useState<any[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchApi<Matter[]>('/api/matters').catch(() => [] as Matter[]),
      fetchApi<any[]>('/api/spend').catch(() => [] as any[]),
      fetchApi<Contract[]>('/api/contracts').catch(() => [] as Contract[]),
      fetchApi<Task[]>('/api/tasks').catch(() => [] as Task[]),
    ])
      .then(([mattersRes, spendRes, contractsRes, tasksRes]) => {
        if (!cancelled) {
          setMatters(mattersRes)
          setSpendTransactions(spendRes)
          setContracts(contractsRes)
          setTasks(tasksRes)
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
  }, [])

  // -----------------------------------------------------------------------
  // Derived data — Report 1: Matter Aging
  // -----------------------------------------------------------------------
  const agingData = useMemo(() => {
    return matters
      .map(m => ({
        name: m.name,
        type: m.type || '-',
        status: m.status,
        createdAt: m.createdAt,
        ageDays: daysAgo(m.createdAt),
      }))
      .sort((a, b) => b.ageDays - a.ageDays)
  }, [matters])

  // -----------------------------------------------------------------------
  // Derived data — Report 2: Spend by Matter Type
  // -----------------------------------------------------------------------
  const spendByTypeData = useMemo(() => {
    const typeMap: Record<string, { count: number; total: number }> = {}
    for (const tx of spendTransactions) {
      if (!tx.matterId) continue
      const matter = matters.find(m => m.id === tx.matterId)
      const type = matter?.type || 'Unknown'
      typeMap[type] = typeMap[type] || { count: 0, total: 0 }
      typeMap[type].count += 1
      typeMap[type].total += tx.amount || 0
    }
    return Object.entries(typeMap)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.total - a.total)
  }, [spendTransactions, matters])

  // -----------------------------------------------------------------------
  // Derived data — Report 3: Contract Expiry
  // -----------------------------------------------------------------------
  const expiryContracts = useMemo(() => {
    return contracts
      .filter(c => c.endDate)
      .map(c => ({
        id: c.id,
        title: c.title,
        counterparty: c.counterparty,
        endDate: c.endDate,
        status: c.status,
        daysLeft: daysUntil(c.endDate),
      }))
      .filter(c => c.daysLeft <= 90)
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [contracts])

  // -----------------------------------------------------------------------
  // Derived data — Report 4: Matters by Status
  // -----------------------------------------------------------------------
  const mattersByStatusData = useMemo(() => {
    const statusMap: Record<string, number> = {}
    for (const m of matters) {
      const status = m.status.toUpperCase()
      statusMap[status] = (statusMap[status] || 0) + 1
    }
    return Object.entries(statusMap)
      .map(([name, value]) => ({ name, value }))
  }, [matters])

  // -----------------------------------------------------------------------
  // Derived data — Report 5: Top Vendors by Spend
  // -----------------------------------------------------------------------
  const topVendorsData = useMemo(() => {
    const vendorMap: Record<string, { count: number; total: number }> = {}
    for (const tx of spendTransactions) {
      const vendor = tx.vendorName || 'Unknown'
      vendorMap[vendor] = vendorMap[vendor] || { count: 0, total: 0 }
      vendorMap[vendor].count += 1
      vendorMap[vendor].total += tx.amount || 0
    }
    return Object.entries(vendorMap)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [spendTransactions])

  // -----------------------------------------------------------------------
  // Derived data — Report 6: Task Burden by Assignee
  // -----------------------------------------------------------------------
  const taskBurdenData = useMemo(() => {
    const assigneeMap: Record<string, { pending: number; in_progress: number; total: number }> = {}
    for (const t of tasks) {
      const name = t.assigneeName || 'Unassigned'
      assigneeMap[name] = assigneeMap[name] || { pending: 0, in_progress: 0, total: 0 }
      assigneeMap[name].total += 1
      if (t.status === 'PENDING') {
        assigneeMap[name].pending += 1
      } else if (t.status === 'IN_PROGRESS') {
        assigneeMap[name].in_progress += 1
      }
    }
    return Object.entries(assigneeMap)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.total - a.total)
  }, [tasks])

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-6">
        <LoadingState>Loading reports...</LoadingState>
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
          <p className="font-medium">Error loading reports</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
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
        <h1 className="text-2xl font-bold text-slate-900">Cross-Matter Reports</h1>
        <span className="text-sm text-slate-500">
          {matters.length} matters · {contracts.length} contracts · {tasks.length} tasks
        </span>
      </div>

      {/* Error per section fallback */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* =============================================================== */}
        {/* REPORT 1: Matter Aging Report                                   */}
        {/* =============================================================== */}
        <Card className="bg-white xl:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="size-5 text-amber-500" />
                Matter Aging Report
              </h3>
              <Badge variant="outline">
                {agingData.length} matters
              </Badge>
            </div>
            {agingData.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon>
                  <Clock className="size-5" />
                </EmptyStateIcon>
                <EmptyStateTitle>No matters found</EmptyStateTitle>
                <EmptyStateDescription>
                  Aging report will appear once matters are created.
                </EmptyStateDescription>
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                        Matter Name
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                        Type
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                        Status
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                        Created
                      </th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                        Age
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agingData.map(m => (
                      <tr key={m.name} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 truncate max-w-xs">
                          {m.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{m.type}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            m.status === 'open' ? 'bg-green-100 text-green-700' :
                            m.status === 'closed' ? 'bg-gray-100 text-gray-700' :
                            m.status === 'on-hold' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ageBadgeClass(m.ageDays)}`}>
                            {m.ageDays} days
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* =============================================================== */}
        {/* REPORT 2: Spend by Matter Type                                 */}
        {/* =============================================================== */}
        <ChartCard title="Spend by Matter Type" isEmpty={spendByTypeData.length === 0}>
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
                <Bar dataKey="total" name="Total Spend" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {spendByTypeData.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {spendByTypeData.length > 0 && (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Matter Type
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Count
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Total Spend
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {spendByTypeData.map(item => (
                    <tr key={item.name} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{item.count}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-slate-900">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        {/* =============================================================== */}
        {/* REPORT 3: Contract Expiry Calendar                             */}
        {/* =============================================================== */}
        <Card className="bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="size-5 text-violet-500" />
                Contract Expiry Calendar
              </h3>
              <Badge variant="outline">
                Next 90 days
              </Badge>
            </div>
            {expiryContracts.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon>
                  <Calendar className="size-5" />
                </EmptyStateIcon>
                <EmptyStateTitle>No upcoming expiries</EmptyStateTitle>
                <EmptyStateDescription>
                  No contracts expiring in the next 90 days.
                </EmptyStateDescription>
              </EmptyState>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {expiryContracts.map(c => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{c.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{c.counterparty}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Expires: {new Date(c.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${expiryBadgeClass(c.daysLeft)}`}>
                        {c.daysLeft <= 0 ? 'Expired' : `${c.daysLeft}d left`}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {c.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* =============================================================== */}
        {/* REPORT 4: Matters by Status                                    */}
        {/* =============================================================== */}
        <ChartCard title="Matters by Status" isEmpty={mattersByStatusData.length === 0}>
          <div className="h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mattersByStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={55}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {mattersByStatusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={MATTER_STATUS_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    borderRadius: 8,
                    fontSize: 13,
                    border: 'none',
                  }}
                  formatter={(value: number, name: string) => [
                    `${value} (${((value / matters.length) * 100).toFixed(0)}%)`,
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* =============================================================== */}
        {/* REPORT 5: Top Vendors by Spend                                 */}
        {/* =============================================================== */}
        <Card className="bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="size-5 text-emerald-500" />
                Top Vendors by Spend
              </h3>
              <Badge variant="outline">
                Top 10
              </Badge>
            </div>
            {topVendorsData.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon>
                  <TrendingUp className="size-5" />
                </EmptyStateIcon>
                <EmptyStateTitle>No vendor data</EmptyStateTitle>
                <EmptyStateDescription>
                  Top vendors will appear once spend transactions are recorded.
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
                      <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                        Transactions
                      </th>
                      <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                        Total Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topVendorsData.map((v, i) => (
                      <tr key={v.name} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400 w-5">#{i + 1}</span>
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {v.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-600">
                          {v.count}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-slate-900">
                          {formatCurrency(v.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* =============================================================== */}
        {/* REPORT 6: Task Burden by Assignee                              */}
        {/* =============================================================== */}
        <Card className="bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Users className="size-5 text-blue-500" />
                Task Burden by Assignee
              </h3>
              <Badge variant="outline">
                Pending + In Progress
              </Badge>
            </div>
            {taskBurdenData.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon>
                  <Users className="size-5" />
                </EmptyStateIcon>
                <EmptyStateTitle>No task data</EmptyStateTitle>
                <EmptyStateDescription>
                  Task burden will appear once tasks are assigned.
                </EmptyStateDescription>
              </EmptyState>
            ) : (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={taskBurdenData}
                      margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                      layout="vertical"
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        width={120}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          color: '#f8fafc',
                          borderRadius: 8,
                          fontSize: 13,
                          border: 'none',
                        }}
                      />
                      <Bar dataKey="pending" name="Pending" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="in_progress" name="In Progress" stackId="a" fill="#3b82f6" radius={[4, 0, 0, 4]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                          Assignee
                        </th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                          Pending
                        </th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                          In Progress
                        </th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {taskBurdenData.map(a => (
                        <tr key={a.name} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{a.name}</td>
                          <td className="px-4 py-3 text-sm text-right text-yellow-600 font-medium">
                            {a.pending}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">
                            {a.in_progress}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-slate-900">
                            {a.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

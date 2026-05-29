import { useState, useEffect } from 'react'
import { fetchApi } from '../api'
import {
  InsightDashboard,
  SpendTrend,
  ContractStatusItem,
  MatterAgingItem,
  IntakeMetrics,
  ActivityItem,
} from '../types'

// ---------------------------------------------------------------------------
// Recharts
// ---------------------------------------------------------------------------
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

// ---------------------------------------------------------------------------
// Team Suzie UI
// ---------------------------------------------------------------------------
import { Card, CardContent } from '@teamsuzie/ui'
import { Badge } from '@teamsuzie/ui'
import { LoadingState } from '@teamsuzie/ui'
import { PageHeader } from '@teamsuzie/ui'
import { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription } from '@teamsuzie/ui'
import { Sparkles, DollarSign, Briefcase, FileText, ListTodo, MessageSquare, TrendingUp, CircleDashed, ArrowUpRight, ArrowDownRight } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types / Interfaces
// ---------------------------------------------------------------------------
type DashboardData = InsightDashboard

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4']
const AGING_COLORS: Record<string, string> = {
  '0-30 days': '#22c55e',
  '31-90 days': '#84cc16',
  '91-180 days': '#f59e0b',
  '181+ days': '#ef4444',
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

function relativeTime(timestamp: string): string {
  try {
    const diff = Date.now() - new Date(timestamp).getTime()
    const secs = Math.floor(diff / 1000)
    if (secs < 60) return `${secs}s ago`
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    return `${months}mo ago`
  } catch {
    return timestamp
  }
}

function activityBadgeColor(type: string): string {
  switch (type) {
    case 'chat':
      return 'bg-blue-100 text-blue-700'
    case 'spend':
      return 'bg-amber-100 text-amber-700'
    case 'intake':
      return 'bg-emerald-100 text-emerald-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function activityIcon(type: string) {
  switch (type) {
    case 'chat':
      return <MessageSquare className="size-3" />
    case 'spend':
      return <DollarSign className="size-3" />
    case 'intake':
      return <ListTodo className="size-3" />
    default:
      return <Sparkles className="size-3" />
  }
}

// ---------------------------------------------------------------------------
// DashboardCard component
// ---------------------------------------------------------------------------
function DashboardCard({
  label,
  value,
  subtext,
  icon,
  trend,
}: {
  label: string
  value: string
  subtext?: string
  icon: React.ReactNode
  trend?: 'up' | 'down'
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
          <div className="flex items-center gap-1.5 text-slate-400">
            {trend === 'up' && <ArrowUpRight className="size-3.5 text-emerald-500" />}
            {trend === 'down' && <ArrowDownRight className="size-3.5 text-red-500" />}
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Chart wrappers with empty-state fallback
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
// Main page
// ---------------------------------------------------------------------------
export default function Insights() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<DashboardData>('/insights/dashboard')
      .then(res => {
        if (!cancelled) {
          setData(res)
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
  // Loading
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-6">
        <LoadingState>Loading insights...</LoadingState>
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
          <p className="font-medium">Error loading insights</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Empty
  // -----------------------------------------------------------------------
  if (!data) {
    return (
      <div className="p-6">
        <PageHeader title="Insights & Reporting" />
        <EmptyState>
          <EmptyStateIcon>
            <TrendingUp className="size-5" />
          </EmptyStateIcon>
          <EmptyStateTitle>No data to display</EmptyStateTitle>
          <EmptyStateDescription>
            Insights will appear once you have matters, contracts, or activity.
          </EmptyStateDescription>
        </EmptyState>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Derived sorted data
  // -----------------------------------------------------------------------
  const sortedActivity: ActivityItem[] = data.recentActivity
    ? [...data.recentActivity].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    : []

  const spendData: SpendTrend[] = data.spendTrends || []
  const contractData: ContractStatusItem[] = data.contractStatus || []
  const agingData: MatterAgingItem[] = data.matterAging || []
  const intake: IntakeMetrics = data.intakeMetrics || {}

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <PageHeader title="Insights & Reporting" />

      {/* ROW 1 — 4 dashboard cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <DashboardCard
          label="Total Matters"
          value={String(data.totalMatters || 0)}
          subtext={`${data.activeMatters || 0} active`}
          icon={<Briefcase className="size-4" />}
          trend="up"
        />
        <DashboardCard
          label="Total Contracts"
          value={String(data.totalContracts || 0)}
          subtext={`${data.activeContracts || 0} active`}
          icon={<FileText className="size-4" />}
          trend="up"
        />
        <DashboardCard
          label="Total Spend"
          value={formatCurrency(data.totalSpend || 0)}
          subtext="Lifetime spend"
          icon={<DollarSign className="size-4" />}
        />
        <DashboardCard
          label="Pending Tasks"
          value={String(data.pendingTasks || 0)}
          subtext="Awaiting attention"
          icon={<ListTodo className="size-4" />}
        />
      </div>

      {/* ROW 2 — Charts 2x2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Spend Trends */}
        <ChartCard title="Spend Trends" isEmpty={spendData.length === 0}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#spendGradient)"
                  name="Amount"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Contract Status */}
        <ChartCard title="Contract Status" isEmpty={contractData.length === 0}>
          <div className="h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={contractData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={55}
                  label={({ status, percent }) =>
                    `${status} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {contractData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Matter Aging */}
        <ChartCard title="Matter Aging" isEmpty={agingData.length === 0}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agingData}
                layout="vertical"
                margin={{ top: 5, right: 30, bottom: 5, left: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="bracket"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
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
                <Bar dataKey="count" name="Count" radius={[0, 6, 6, 0]}>
                  {agingData.map((_entry, index) => {
                    const color = AGING_COLORS[_entry.bracket] || PIE_COLORS[index % PIE_COLORS.length]
                    return <Cell key={`cell-${index}`} fill={color} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Intake Metrics */}
        <ChartCard title="Intake Metrics" isEmpty={
          intake.totalSubmissions === 0 &&
          intake.pendingCount === 0 &&
          intake.triagedCount === 0 &&
          intake.convertedCount === 0 &&
          intake.rejectedCount === 0
        }>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Pending', value: intake.pendingCount || 0 },
                  { name: 'Triaged', value: intake.triagedCount || 0 },
                  { name: 'Converted', value: intake.convertedCount || 0 },
                  { name: 'Rejected', value: intake.rejectedCount || 0 },
                ].filter(d => d.value > 0)}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
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
                <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
                  {[
                    { name: 'Pending', color: '#f59e0b' },
                    { name: 'Triaged', color: '#3b82f6' },
                    { name: 'Converted', color: '#22c55e' },
                    { name: 'Rejected', color: '#ef4444' },
                  ].map((item, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={item.color}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* ROW 3 — Recent Activity Feed */}
      <Card className="bg-white">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Recent Activity</h3>
            {sortedActivity.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {sortedActivity.length} items
              </Badge>
            )}
          </div>
          {sortedActivity.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <EmptyState>
                <EmptyStateIcon>
                  <CircleDashed className="size-5 text-slate-300" />
                </EmptyStateIcon>
                <EmptyStateTitle>No activity yet</EmptyStateTitle>
                <EmptyStateDescription>
                  Activity from matters, contracts, and intake forms will appear here.
                </EmptyStateDescription>
              </EmptyState>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {sortedActivity.map(activity => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 hover:bg-slate-100 transition-colors"
                >
                  <Badge
                    variant="outline"
                    className={`${activityBadgeColor(activity.type)} flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 h-auto mt-0.5`}
                  >
                    {activityIcon(activity.type)}
                    {activity.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 leading-snug">
                      {activity.description}
                    </p>
                    {/* Matter name if available */}
                    {activity.description.match(/matter[s]?\s*["'"'"']?(.+?)["'"'"']?/i) && null}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 tabular-nums mt-0.5">
                    {relativeTime(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

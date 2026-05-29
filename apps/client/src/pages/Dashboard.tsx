import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchApi } from '../api'
import { InsightDashboard, ActivityItem } from '../types'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<InsightDashboard | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<InsightDashboard>('/insights/dashboard')
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

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading dashboard</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-slate-500">No data to display.</p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Active Matters" value={String(data.activeMatters || 0)} />
        <KpiCard label="Contracts Active" value={String(data.contractsActive || 0)} />
        <KpiCard label="Pending Tasks" value={String(data.pendingTasks || 0)} />
        <KpiCard label="Total Spend (YTD)" value={`$${(data.totalSpendYtd || 0).toLocaleString()}`} />
      </div>

      {/* Recent Matters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Matters</h2>
        {data.recentMatters && data.recentMatters.length > 0 ? (
          <div className="space-y-2">
            {data.recentMatters.slice(0, 5).map(matter => (
              <Link
                key={matter.id}
                to={`/matters/${matter.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-xs">📁</span>
                  <span className="text-sm font-medium text-slate-800">{matter.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  matter.status === 'open' ? 'bg-green-100 text-green-700' :
                  matter.status === 'on-hold' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {matter.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No matters yet. Create one to get started.</p>
        )}
      </div>

      {/* Recent Activity */}
      {data.recentActivity && data.recentActivity.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {data.recentActivity.slice(0, 10).map(activity => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  )
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const timeAgo = (ts: string) => {
    try {
      const diff = Date.now() - new Date(ts).getTime()
      const mins = Math.floor(diff / 60000)
      if (mins < 60) return `${mins}m ago`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return `${hrs}h ago`
      const days = Math.floor(hrs / 24)
      return `${days}d ago`
    } catch {
      return ts
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-16 shrink-0">{timeAgo(activity.timestamp)}</span>
      <span className="text-sm text-slate-600">{activity.description}</span>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchApi } from '../api'
import { AuditEntry } from '../types'

export default function AuditLog() {
  const { matterId } = useParams<{ matterId: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<AuditEntry[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    if (!matterId) {
      setError('No matter ID provided')
      setLoading(false)
      return
    }
    fetchApi<AuditEntry[]>(`/audit/${matterId}`)
      .then(res => {
        if (!cancelled) {
          setEntries(res)
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
  }, [matterId])

  function timeAgo(ts: string): string {
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

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading audit log...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading audit log</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        {matterId && (
          <Link
            to="/matters"
            className="text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            &larr; Back to Matters
          </Link>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500 text-sm">No audit activity recorded for this matter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Timestamp</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-500 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400">{timeAgo(entry.timestamp)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{entry.userName || entry.userId || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{entry.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

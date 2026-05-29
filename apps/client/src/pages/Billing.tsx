import { useState, useEffect } from 'react'
import { fetchApi } from '../api'
import { Invoice, TimeEntry } from '../types'

type Tab = 'invoices' | 'time-entries'

export default function Billing() {
  const [activeTab, setActiveTab] = useState<Tab>('invoices')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchApi<Invoice[]>('/billing/invoices').catch(() => [] as Invoice[]),
      fetchApi<TimeEntry[]>('/billing/time-entries').catch(() => [] as TimeEntry[]),
    ])
      .then(([inv, te]) => {
        if (!cancelled) {
          setInvoices(inv)
          setTimeEntries(te)
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

  async function markAsPaid(id: string) {
    setActionLoading(id)
    try {
      await fetchApi(`/billing/invoices/${id}/paid`, { method: 'PATCH' })
      setInvoices(prev =>
        prev.map(inv => (inv.id === id ? { ...inv, status: 'paid' as const } : inv))
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark as paid')
    } finally {
      setActionLoading(null)
    }
  }

  async function approveInvoice(id: string) {
    setActionLoading(id)
    try {
      await fetchApi(`/billing/invoices/${id}/approve`, { method: 'POST' })
      setInvoices(prev =>
        prev.map(inv => (inv.id === id ? { ...inv, status: 'approved' as const } : inv))
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve invoice')
    } finally {
      setActionLoading(null)
    }
  }

  async function autoBill(id: string) {
    setActionLoading(id)
    try {
      await fetchApi(`/billing/time-entries/${id}/bill`, { method: 'POST' })
      setTimeEntries(prev =>
        prev.map(te => (te.id === id ? { ...te, billed: true } : te))
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to auto-bill entry')
    } finally {
      setActionLoading(null)
    }
  }

  function formatCurrency(amount: number) {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return dateStr
    }
  }

  function durationLabel(minutes: number) {
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hrs === 0) return `${mins}m`
    if (mins === 0) return `${hrs}h`
    return `${hrs}h ${mins}m`
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading billing data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading billing data</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Billing</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab('time-entries')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'time-entries'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Time Entries
        </button>
      </div>

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <>
          {invoices.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <p className="text-slate-500 text-sm">No invoices found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Invoice #</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Matter</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Amount</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Date</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-mono text-slate-600">{inv.id.slice(0, 8)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{inv.matterName || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 font-semibold">{formatCurrency(inv.amount)}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[inv.status] || 'bg-slate-100 text-slate-600'}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{formatDate(inv.date)}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {inv.status === 'paid' ? null : inv.status === 'pending' ? (
                              <button
                                onClick={() => approveInvoice(inv.id)}
                                disabled={actionLoading === inv.id}
                                className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {actionLoading === inv.id ? 'Approving...' : 'Approve'}
                              </button>
                            ) : (
                              <button
                                onClick={() => markAsPaid(inv.id)}
                                disabled={actionLoading === inv.id}
                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {actionLoading === inv.id ? 'Marking...' : 'Mark as Paid'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Time Entries Tab */}
      {activeTab === 'time-entries' && (
        <>
          {timeEntries.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <p className="text-slate-500 text-sm">No time entries found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Date</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Matter</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">User</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Duration</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Description</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {timeEntries.map(te => (
                      <tr key={te.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500">{formatDate(te.date)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{te.matterName || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{te.userName || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{durationLabel(te.duration)}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{te.description || '-'}</td>
                        <td className="px-6 py-4">
                          {te.billed ? (
                            <span className="text-xs text-slate-400">Billed</span>
                          ) : (
                            <button
                              onClick={() => autoBill(te.id)}
                              disabled={actionLoading === te.id}
                              className="text-xs bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700 disabled:opacity-50"
                            >
                              {actionLoading === te.id ? 'Billing...' : 'Auto-Bill'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchApi } from '../api'
import { IntakeForm, IntakeSubmission, IntakeFormField, TriageResult } from '../types'

type Tab = 'forms' | 'submissions'
type StatusBadge = 'PENDING' | 'TRIAGED' | 'CONVERTED' | 'REJECTED'

const STATUS_COLORS: Record<StatusBadge, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  TRIAGED: 'bg-blue-100 text-blue-800',
  CONVERTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
}

const STATUS_FLOW: Record<StatusBadge, StatusBadge | null> = {
  PENDING: 'TRIAGED',
  TRIAGED: 'CONVERTED',
  CONVERTED: null,
  REJECTED: null,
}

export default function IntakeAdmin() {
  const [tab, setTab] = useState<Tab>('forms')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Forms data
  const [forms, setForms] = useState<IntakeForm[]>([])

  // Submissions data
  const [submissions, setSubmissions] = useState<IntakeSubmission[]>([])
  const [viewingSubmission, setViewingSubmission] = useState<IntakeSubmission | null>(null)
  const [parsedAnswers, setParsedAnswers] = useState<Record<string, string>>({})

  // Updating status
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  // Delete
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null)

  // AI Triage state
  const [triageLoading, setTriageLoading] = useState<string | null>(null)
  const [triageResults, setTriageResults] = useState<Record<string, TriageResult>>({})
  const [triageAccepting, setTriageAccepting] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchApi<IntakeForm[]>('/intake/forms').then(res => { if (!cancelled) setForms(res) }),
      fetchApi<IntakeSubmission[]>('/intake/submissions').then(res => { if (!cancelled) setSubmissions(res) }),
    ])
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleDeleteForm(id: string) {
    if (!confirm('Delete this intake form and all its submissions?')) return
    setDeletingFormId(id)
    try {
      await fetchApi(`/intake/forms/${id}`, { method: 'DELETE' })
      setForms(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete form')
    } finally {
      setDeletingFormId(null)
    }
  }

  async function handleUpdateStatus(submissionId: string, currentStatus: StatusBadge) {
    const next = STATUS_FLOW[currentStatus]
    if (!next) return
    setUpdatingStatus(submissionId)
    try {
      await fetchApi(`/intake/submissions/${submissionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      setSubmissions(prev =>
        prev.map(s => (s.id === submissionId ? { ...s, status: next as any } : s))
      )
      if (viewingSubmission?.id === submissionId) {
        setViewingSubmission(prev => prev ? { ...prev, status: next as any } : null)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingStatus(null)
    }
  }

  function openSubmissionDetails(sub: IntakeSubmission) {
    setViewingSubmission(sub)
    try {
      setParsedAnswers(JSON.parse(sub.answers))
    } catch {
      setParsedAnswers({ _raw: sub.answers })
    }
  }

  async function runTriage(sub: IntakeSubmission) {
    setTriageLoading(sub.id)
    try {
      const answers = typeof sub.answers === 'string' ? JSON.parse(sub.answers) : sub.answers
      // We need the form details — fetch the form to get orgId
      const formDetail = await fetchApi<any>(`/intake/forms/${sub.formId}`)
      const orgId = formDetail?.orgId || ''

      const result: TriageResult = await fetchApi<TriageResult>('/ai/intake/triage', {
        method: 'POST',
        body: JSON.stringify({
          formId: sub.formId,
          answers,
          orgId,
        }),
      })

      setTriageResults(prev => ({ ...prev, [sub.id]: result }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'AI triage failed')
    } finally {
      setTriageLoading(null)
    }
  }

  async function acceptTriage(sub: IntakeSubmission) {
    const result = triageResults[sub.id]
    if (!result) return

    setTriageAccepting(sub.id)
    try {
      // Update submission status to TRIAGED and store triage result
      await fetchApi(`/intake/submissions/${sub.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'TRIAGED' }),
      })

      // Update the submission in local state
      setSubmissions(prev =>
        prev.map(s =>
          s.id === sub.id
            ? { ...s, status: 'TRIAGED' as const, triageResult: JSON.stringify(result) }
            : s
        )
      )

      // Update viewing submission if open
      if (viewingSubmission?.id === sub.id) {
        setViewingSubmission(prev => prev ? { ...prev, status: 'TRIAGED' as const, triageResult: JSON.stringify(result) } : null)
      }

      // Clear triage results for this submission
      setTriageResults(prev => {
        const next = { ...prev }
        delete next[sub.id]
        return next
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept triage results')
    } finally {
      setTriageAccepting(null)
    }
  }

  function parseSchema(schemaStr: string | null): IntakeFormField[] {
    if (!schemaStr) return []
    try {
      return JSON.parse(schemaStr)
    } catch {
      return []
    }
  }

  function formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading intake admin...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading data</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Intake Management</h1>
        <Link
          to="/intake/form-builder"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors"
        >
          Create Form
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab('forms')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'forms'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Forms
        </button>
        <button
          onClick={() => setTab('submissions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'submissions'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Submissions
        </button>
      </div>

      {/* Forms Tab */}
      {tab === 'forms' && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Submissions</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Fields</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {forms.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                      No intake forms yet.{' '}
                      <Link to="/intake/form-builder" className="text-primary-600 hover:underline">
                        Create one
                      </Link>
                    </td>
                  </tr>
                ) : (
                  forms.map(form => {
                    const fieldCount = parseSchema(form.formSchema).length
                    return (
                      <tr key={form.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{form.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{form.submissionsCount}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{fieldCount}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Link
                              to={`/intake/form-builder?edit=${form.id}`}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDeleteForm(form.id)}
                              disabled={deletingFormId === form.id}
                              className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            >
                              {deletingFormId === form.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submissions Tab */}
      {tab === 'submissions' && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Form</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Submitter</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Date</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                        No submissions yet.
                      </td>
                    </tr>
                  ) : (
                    submissions.map(sub => (
                      <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {sub.form?.name || 'Unknown Form'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{sub.submitter}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sub.status as StatusBadge]}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{new Date(sub.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 items-center">
                            {/* AI Triage button (only for PENDING) */}
                            {sub.status === 'PENDING' && !triageResults[sub.id] && (
                              <button
                                onClick={() => runTriage(sub)}
                                disabled={triageLoading === sub.id}
                                className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-1 rounded-lg font-medium disabled:opacity-50 transition-colors"
                                title="Run AI auto-triage"
                              >
                                {triageLoading === sub.id ? 'Running...' : 'AI Triage'}
                              </button>
                            )}
                            <button
                              onClick={() => openSubmissionDetails(sub)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submission Detail Modal */}
          {viewingSubmission && (() => {
            const triageResult = triageResults[viewingSubmission.id]
            const existingTriage = viewingSubmission.triageResult
              ? (() => {
                  try { return JSON.parse(viewingSubmission.triageResult) as TriageResult } catch { return null }
                })()
              : null

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Submission Details</h2>
                      <p className="text-sm text-slate-500 mt-1">
                        Form: {viewingSubmission.form?.name} | Submitter: {viewingSubmission.submitter}
                      </p>
                    </div>
                    <button
                      onClick={() => setViewingSubmission(null)}
                      className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                    >
                      ×
                    </button>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-3 mb-6">
                    <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[viewingSubmission.status as StatusBadge]}`}>
                      {viewingSubmission.status}
                    </span>
                    {STATUS_FLOW[viewingSubmission.status as StatusBadge] && (
                      <button
                        onClick={() => handleUpdateStatus(viewingSubmission.id, viewingSubmission.status as StatusBadge)}
                        disabled={updatingStatus === viewingSubmission.id}
                        className="text-xs bg-primary-600 text-white px-3 py-1 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updatingStatus === viewingSubmission.id ? 'Updating...' : `Mark as ${STATUS_FLOW[viewingSubmission.status as StatusBadge]}`}
                      </button>
                    )}
                  </div>

                  {/* AI Triage Results */}
                  {(triageResult || existingTriage) && (
                    <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                          <span className="text-lg">🤖</span> AI Triage Results
                        </h3>
                        {triageResult && (
                          <button
                            onClick={() => acceptTriage(viewingSubmission)}
                            disabled={triageAccepting === viewingSubmission.id}
                            className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors"
                          >
                            {triageAccepting === viewingSubmission.id ? 'Applying...' : '✓ Accept'}
                          </button>
                        )}
                      </div>

                      {/* Suggested Matter Type */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                          <p className="text-xs text-slate-500 uppercase font-medium mb-1">Suggested Type</p>
                          <p className="text-sm font-semibold text-slate-900">{triageResult?.suggestedMatterType || existingTriage?.suggestedMatterType}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                          <p className="text-xs text-slate-500 uppercase font-medium mb-1">Suggested Title</p>
                          <p className="text-sm font-semibold text-slate-900">{triageResult?.suggestedMatterTitle || existingTriage?.suggestedMatterTitle}</p>
                        </div>
                      </div>

                      {/* Priority + Confidence */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                          <p className="text-xs text-slate-500 uppercase font-medium mb-1">Priority</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${PRIORITY_COLORS[(triageResult?.priority || existingTriage?.priority) || 'MEDIUM']}`}>
                            {triageResult?.priority || existingTriage?.priority}
                          </span>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                          <p className="text-xs text-slate-500 uppercase font-medium mb-1">Confidence</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatConfidence(triageResult?.confidence ?? 0)}
                          </p>
                        </div>
                      </div>

                      {/* Prefilled Fields */}
                      {(triageResult?.prefill || existingTriage?.prefill) && (
                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                          <p className="text-xs text-slate-500 uppercase font-medium mb-2">Pre-filled Fields</p>
                          {Object.entries(triageResult?.prefill || existingTriage?.prefill || {}).map(([key, value]) => (
                            <div key={key} className="mb-1">
                              <span className="text-xs text-slate-500">{key}: </span>
                              <span className="text-sm text-slate-800">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Triage button (only for PENDING, no results yet) */}
                  {viewingSubmission.status === 'PENDING' && !triageResult && !existingTriage && (
                    <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🤖</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-purple-900">AI Auto-Triage</p>
                          <p className="text-xs text-purple-600">Let the AI analyze this submission and suggest a matter type, title, and priority.</p>
                        </div>
                        <button
                          onClick={() => runTriage(viewingSubmission)}
                          disabled={triageLoading === viewingSubmission.id}
                          className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors"
                        >
                          {triageLoading === viewingSubmission.id ? 'Analyzing...' : 'Run AI Triage'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Answers */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700">Answers</h3>
                    {Object.entries(parsedAnswers).map(([key, value]) => (
                      <div key={key} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 uppercase font-medium mb-1">{key}</p>
                        <p className="text-sm text-slate-800 break-words">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 text-xs text-slate-400">
                    Submitted: {new Date(viewingSubmission.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchApi } from '../api'
import { IntakeForm } from '../types'

export default function IntakePortal() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forms, setForms] = useState<IntakeForm[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<IntakeForm[]>('/intake/forms')
      .then(res => {
        if (!cancelled) {
          setForms(res)
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading intake forms...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">Failed to load intake forms</p>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Laiw AI</h1>
            <p className="text-sm text-slate-500 mt-1">Legal Operating System</p>
          </div>
          <Link
            to="/login"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Login
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-12 pb-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">Intake Requests</h2>
          <p className="text-slate-500 mt-3 max-w-lg mx-auto">
            Select an intake form below to submit your request. Our team will review and process it.
          </p>
        </div>

        {/* Forms grid */}
        {forms.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-lg">No intake forms are currently available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map(form => (
              <Link
                key={form.id}
                to={`/intake/${form.id}`}
                className="group bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-primary-300 transition-all"
              >
                <h3 className="text-lg font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">
                  {form.name}
                </h3>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                    {form.submissionsCount} submission{form.submissionsCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-sm text-primary-600 mt-4 flex items-center gap-1">
                  Start form
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

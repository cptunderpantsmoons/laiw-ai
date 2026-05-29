import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchApi } from '../api'
import { IntakeForm, IntakeFormField } from '../types'

export default function IntakeFormPage() {
  const { formId } = useParams<{ formId: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState<IntakeForm | null>(null)
  const [fields, setFields] = useState<IntakeFormField[]>([])
  const [submitter, setSubmitter] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<IntakeForm>(`/intake/forms/${formId}`)
      .then(res => {
        if (!cancelled) {
          setForm(res)
          if (res.formSchema) {
            try {
              const parsed: IntakeFormField[] = JSON.parse(res.formSchema)
              setFields(parsed)
            } catch {
              setError('Invalid form schema')
            }
          }
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
  }, [formId])

  function handleAnswerChange(name: string, value: string) {
    setAnswers(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    // Validate required fields
    for (const field of fields) {
      if (field.required && !answers[field.name]?.trim()) {
        setFormError(`"${field.label}" is required`)
        return
      }
    }

    setSubmitting(true)
    try {
      await fetchApi(`/intake/${formId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          submitter: submitter.trim(),
          answers: JSON.stringify(answers),
        }),
      })
      setSuccess(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit form')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading form...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">Form not found</p>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
          <Link
            to="/intake"
            className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            Back to intake forms
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Submission Received</h2>
          <p className="text-slate-500 mt-2">
            Your {form?.name} form has been submitted successfully.
          </p>
          <Link
            to="/intake"
            className="mt-6 inline-block bg-primary-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Submit Another Form
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/intake"
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            ← Back to forms
          </Link>
          <span className="text-sm text-slate-400">Laiw AI Intake</span>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{form?.name}</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          {/* Submitter name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Your Name *
            </label>
            <input
              type="text"
              value={submitter}
              onChange={e => setSubmitter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              placeholder="Enter your name"
              required
            />
          </div>

          {/* Dynamic fields */}
          {fields.map(field => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {field.type === 'textarea' && (
                <textarea
                  value={answers[field.name] || ''}
                  onChange={e => handleAnswerChange(field.name, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-y min-h-[80px]"
                  rows={3}
                  required={field.required}
                />
              )}

              {field.type === 'select' && (
                <select
                  value={answers[field.name] || ''}
                  onChange={e => handleAnswerChange(field.name, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  required={field.required}
                >
                  <option value="">-- Select --</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.type === 'email' && (
                <input
                  type="email"
                  value={answers[field.name] || ''}
                  onChange={e => handleAnswerChange(field.name, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="email@example.com"
                  required={field.required}
                />
              )}

              {field.type === 'date' && (
                <input
                  type="date"
                  value={answers[field.name] || ''}
                  onChange={e => handleAnswerChange(field.name, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  required={field.required}
                />
              )}

              {field.type === 'text' && (
                <input
                  type="text"
                  value={answers[field.name] || ''}
                  onChange={e => handleAnswerChange(field.name, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder={field.label}
                  required={field.required}
                />
              )}
            </div>
          ))}

          {/* Error / Submit */}
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Form'}
          </button>
        </form>
      </div>
    </div>
  )
}

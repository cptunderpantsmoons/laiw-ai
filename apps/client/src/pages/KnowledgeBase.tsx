import { useState, useEffect } from 'react'
import { fetchApi } from '../api'
import { KbEntry } from '../types'

export default function KnowledgeBase() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<KbEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi<KbEntry[]>('/kb/entries')
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
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSubmitting(true)
    try {
      const entry = await fetchApi<KbEntry>('/kb/entries', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      })
      setEntries(prev => [entry, ...prev])
      setTitle('')
      setBody('')
      setShowForm(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create entry')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading knowledge base...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors"
        >
          New Entry
        </button>
      </div>

      {/* New Entry Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New Entry</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Entry title"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Body (Markdown)</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                placeholder="Write in markdown format..."
                rows={8}
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium text-sm disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Entry'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100 font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading knowledge base</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500 text-sm">No knowledge base entries yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map(entry => (
            <KbCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

function KbCard({ entry }: { entry: KbEntry }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <h3 className="text-base font-semibold text-slate-900 mb-2">{entry.title}</h3>
      <p className="text-sm text-slate-600 line-clamp-3 mb-3 whitespace-pre-wrap">{entry.body}</p>
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.tags.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400 mt-3">
        Updated {new Date(entry.updatedAt).toLocaleDateString()}
      </p>
    </div>
  )
}

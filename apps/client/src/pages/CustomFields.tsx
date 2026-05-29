import { useState, useEffect } from 'react'
import { fetchApi } from '../api'

interface CustomField {
  id: string
  orgId: string
  name: string
  fieldType: 'text' | 'select' | 'date' | 'number' | 'boolean'
  options: string | null
  required: boolean
  createdAt: string
  values?: { matterId: string; value: string }[]
}

export default function CustomFields() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<CustomField[]>([])
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [type, setType] = useState<'text' | 'select' | 'date' | 'number' | 'boolean'>('text')
  const [options, setOptions] = useState('')
  const [required, setRequired] = useState(false)

  // Org ID filter
  const [orgId, setOrgId] = useState('')
  const [orgInput, setOrgInput] = useState('')

  const fieldTypes: { value: 'text' | 'select' | 'date' | 'number' | 'boolean'; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'select', label: 'Select' },
    { value: 'date', label: 'Date' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
  ]

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    setLoading(true)
    fetchApi<CustomField[]>(`/custom-fields?orgId=${orgId}`)
      .then(res => {
        if (!cancelled) {
          setFields(res)
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
  }, [orgId])

  function loadFields() {
    if (!orgInput.trim()) return
    setOrgId(orgInput.trim())
  }

  function openCreateForm() {
    setEditId(null)
    setName('')
    setType('text')
    setOptions('')
    setRequired(false)
    setShowForm(true)
  }

  function openEditForm(field: CustomField) {
    setEditId(field.id)
    setName(field.name)
    setType(field.fieldType as 'text' | 'select' | 'date' | 'number' | 'boolean')
    setOptions(field.options || '')
    setRequired(field.required)
    setShowForm(true)
  }

  function resetForm() {
    setShowForm(false)
    setName('')
    setType('text')
    setOptions('')
    setRequired(false)
    setEditId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (!orgId) {
      alert('Please enter and load an Organization ID first.')
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        orgId,
        name: name.trim(),
        type,
        required,
      }
      if (type === 'select') {
        const opts = options.split(',').map(s => s.trim()).filter(Boolean)
        if (opts.length === 0) {
          alert('Select type requires at least one option (comma-separated)')
          setSubmitting(false)
          return
        }
        body.options = opts
      } else {
        body.options = null
      }

      let result: CustomField
      if (editId) {
        const updateBody: Record<string, unknown> = { name, type, required }
        if (type === 'select') {
          const opts = options.split(',').map(s => s.trim()).filter(Boolean)
          updateBody.options = opts
        } else {
          updateBody.options = null
        }
        result = await fetchApi(`/custom-fields/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(updateBody),
        })
        setFields(prev => prev.map(f => (f.id === editId ? result : f)))
      } else {
        result = await fetchApi('/custom-fields', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        setFields(prev => [result, ...prev])
      }
      resetForm()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save custom field')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this custom field?')) return
    try {
      await fetchApi(`/custom-fields/${id}`, { method: 'DELETE' })
      setFields(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete custom field')
    }
  }

  const typeColors: Record<string, string> = {
    text: 'bg-slate-100 text-slate-700',
    select: 'bg-purple-100 text-purple-700',
    date: 'bg-blue-100 text-blue-700',
    number: 'bg-green-100 text-green-700',
    boolean: 'bg-yellow-100 text-yellow-700',
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading custom fields...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Custom Matter Fields</h1>
        <button
          onClick={openCreateForm}
          disabled={!orgId}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          New Field
        </button>
      </div>

      {/* Org ID Lookup */}
      {!orgId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800 font-medium mb-2">
            Enter an Organization ID to view custom fields for that organization.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={orgInput}
              onChange={e => setOrgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadFields()}
              placeholder="Organization UUID"
              className="flex-1 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
            />
            <button
              onClick={loadFields}
              className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 font-medium text-sm"
            >
              Load Fields
            </button>
          </div>
        </div>
      )}

      {orgId && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing fields for org: <span className="font-mono text-xs">{orgId}</span>
          </div>
          <button
            onClick={() => {
              setOrgId('')
              setOrgInput('')
              setFields([])
            }}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium"
          >
            Change Organization
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editId ? 'Edit Field' : 'Create New Field'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Field Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., Client Reference Number"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Field Type *</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as typeof type)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {fieldTypes.map(ft => (
                    <option key={ft.value} value={ft.value}>
                      {ft.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {type === 'select' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Options <span className="text-slate-400">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={options}
                  onChange={e => setOptions(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., Option A, Option B, Option C"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="required"
                checked={required}
                onChange={e => setRequired(e.target.checked)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="required" className="text-sm font-medium text-slate-700">
                Required field
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium text-sm disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editId ? 'Save Changes' : 'Create Field'}
              </button>
              <button
                type="button"
                onClick={resetForm}
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
          <p className="font-medium">Error loading custom fields</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Fields Table */}
      {!orgId ? null : fields.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <p className="text-slate-500 text-sm">
            No custom fields found for this organization. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Options</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Required</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Values</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fields.map(field => (
                  <tr key={field.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {field.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[field.fieldType] || 'bg-slate-100 text-slate-700'}`}>
                        {field.fieldType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {field.options ? JSON.parse(field.options).join(', ') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {field.required ? 'Yes' : 'No'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {field.values?.length || 0} value{field.values?.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditForm(field)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(field.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
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

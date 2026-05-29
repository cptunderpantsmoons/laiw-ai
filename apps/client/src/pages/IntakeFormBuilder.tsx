import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { fetchApi } from '../api'
import { IntakeFormField } from '../types'

const FIELD_TYPES: { value: IntakeFormField['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
]

const INITIAL_FIELD = (): IntakeFormField => ({
  name: '',
  label: '',
  type: 'text',
  required: false,
  options: [],
})

export default function IntakeFormBuilder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [formName, setFormName] = useState('')
  const [fields, setFields] = useState<IntakeFormField[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!editId)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Load existing form when editing
  useEffect(() => {
    if (!editId) return
    let cancelled = false
    fetchApi<{ id: string; name: string; formSchema: string | null }>(`/intake/forms/${editId}`)
      .then(res => {
        if (!cancelled) {
          setFormName(res.name)
          if (res.formSchema) {
            try {
              setFields(JSON.parse(res.formSchema))
            } catch {
              setError('Invalid form schema in existing form')
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
  }, [editId])

  function addField() {
    setFields(prev => [...prev, INITIAL_FIELD()])
  }

  function updateField(index: number, key: keyof IntakeFormField, value: string | boolean) {
    setFields(prev => {
      const updated = [...prev]
      // For 'options', value should be string (comma-separated)
      if (key === 'options' && typeof value === 'string') {
        updated[index] = { ...updated[index], options: value.split(',').map(s => s.trim()).filter(Boolean) }
      } else {
        updated[index] = { ...updated[index], [key]: value }
      }
      return updated
    })
  }

  function removeField(index: number) {
    setFields(prev => prev.filter((_, i) => i !== index))
  }

  function moveField(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= fields.length) return
    setFields(prev => {
      const updated = [...prev]
      ;[updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]]
      return updated
    })
  }

  function getSchemaJson(): string {
    // Validate fields before saving
    const valid = fields.filter(f => f.name.trim() && f.label.trim())
    return JSON.stringify(valid, null, 2)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) {
      setError('Form name is required')
      return
    }
    const validFields = fields.filter(f => f.name.trim() && f.label.trim())
    if (validFields.length === 0) {
      setError('Add at least one field')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const schemaJson = JSON.stringify(validFields)
      if (editId) {
        await fetchApi(`/intake/forms/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: formName.trim(), formSchema: schemaJson }),
        })
      } else {
        await fetchApi('/intake/forms', {
          method: 'POST',
          body: JSON.stringify({ name: formName.trim(), formSchema: schemaJson }),
        })
      }
      setSaved(true)
      setTimeout(() => navigate('/intake/admin'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading form...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">
          {editId ? 'Edit Intake Form' : 'Create Intake Form'}
        </h1>
        <Link
          to="/intake/admin"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to Intake Admin
        </Link>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Form saved successfully! Redirecting...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Form name */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Form Name *
          </label>
          <input
            type="text"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            placeholder="e.g. Client Intake Form"
            required
          />
        </div>

        {/* Fields */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900">Form Fields</h2>
            <button
              type="button"
              onClick={addField}
              className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-primary-700 font-medium transition-colors"
            >
              + Add Field
            </button>
          </div>

          {fields.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              Click "Add Field" to start building your form.
            </p>
          )}

          {fields.map((field, index) => (
            <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase">Field {index + 1}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveField(index, -1)}
                    disabled={index === 0}
                    className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(index, 1)}
                    disabled={index === fields.length - 1}
                    className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Variable Name *</label>
                  <input
                    type="text"
                    value={field.name}
                    onChange={e => updateField(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="client_name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Label *</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={e => updateField(index, 'label', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Client Name"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select
                    value={field.type}
                    onChange={e => updateField(index, 'type', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required || false}
                      onChange={e => updateField(index, 'required', e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    Required
                  </label>
                </div>
              </div>

              {field.type === 'select' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Options (comma-separated)</label>
                  <input
                    type="text"
                    value={(field.options || []).join(', ')}
                    onChange={e => updateField(index, 'options', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Option 1, Option 2, Option 3"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Live Preview</h2>
          <div className="border border-slate-200 rounded-lg p-4 space-y-4 bg-slate-50">
            {formName && <p className="text-sm font-medium text-slate-500">{formName}</p>}
            {fields.map((field, index) => (
              <div key={index}>
                <label className="block text-sm text-slate-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.type === 'textarea' && (
                  <textarea disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white resize-y min-h-[60px]" rows={2} />
                )}
                {field.type === 'select' && (
                  <select disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option>-- Select --</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
                {field.type === 'email' && (
                  <input disabled type="email" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                )}
                {field.type === 'date' && (
                  <input disabled type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                )}
                {field.type === 'text' && (
                  <input disabled type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" placeholder={field.label} />
                )}
              </div>
            ))}
            {fields.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No fields added yet</p>
            )}
          </div>
        </div>

        {/* Schema JSON */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Schema JSON</h2>
          <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg text-xs overflow-auto max-h-48 whitespace-pre-wrap">
            {getSchemaJson()}
          </pre>
        </div>

        {/* Save */}
        <div className="flex gap-3 justify-end">
          <Link
            to="/intake/admin"
            className="text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100 font-medium text-sm transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : editId ? 'Update Form' : 'Save Form'}
          </button>
        </div>
      </form>
    </div>
  )
}

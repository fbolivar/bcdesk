'use client'

import { useState } from 'react'
import { saveCustomValue } from '@/features/admin/services/custom-fields.service'

interface CustomField {
  id: string
  name: string
  field_key: string
  field_type: string
  options: string[] | null
  required: boolean
}

interface FieldValue { field_id: string; value: string | null }

interface Props {
  ticketId: string
  fields: CustomField[]
  values: FieldValue[]
}

export function CustomFieldsPanel({ ticketId, fields, values }: Props) {
  const [localValues, setLocalValues] = useState<Record<string, string>>(
    Object.fromEntries(values.map(v => [v.field_id, v.value ?? '']))
  )
  const [saving, setSaving] = useState<string | null>(null)

  if (fields.length === 0) return null

  async function handleChange(fieldId: string, value: string) {
    setLocalValues(prev => ({ ...prev, [fieldId]: value }))
    setSaving(fieldId)
    await saveCustomValue(ticketId, fieldId, value)
    setSaving(null)
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
      <p className="text-xs font-semibold text-[#64748B] mb-3">Campos adicionales</p>
      <div className="space-y-3">
        {fields.map(field => (
          <div key={field.id}>
            <label className="block text-xs text-[#64748B] mb-1">
              {field.name}
              {field.required && <span className="text-[#EF4444] ml-0.5">*</span>}
              {saving === field.id && <span className="text-[#3B82F6] ml-1 text-[10px]">guardando…</span>}
            </label>

            {field.field_type === 'select' ? (
              <select value={localValues[field.id] ?? ''} onChange={e => handleChange(field.id, e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#64748B] text-sm focus:outline-none focus:border-[#3B82F6]">
                <option value="">— seleccionar —</option>
                {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : field.field_type === 'boolean' ? (
              <div className="flex gap-3">
                {['Sí', 'No'].map(opt => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-sm text-[#64748B]">
                    <input type="radio" name={field.id} value={opt}
                      checked={localValues[field.id] === opt}
                      onChange={() => handleChange(field.id, opt)}
                      className="accent-[#3B82F6]" />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <input
                type={field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text'}
                value={localValues[field.id] ?? ''}
                onChange={e => handleChange(field.id, e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

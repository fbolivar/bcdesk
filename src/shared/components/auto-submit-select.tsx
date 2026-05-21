'use client'

interface AutoSubmitSelectProps {
  name: string
  defaultValue: string
  options: { value: string; label: string }[]
  className?: string
}

export function AutoSubmitSelect({ name, defaultValue, options, className }: AutoSubmitSelectProps) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={e => (e.target.form as HTMLFormElement).requestSubmit()}
      className={className}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

interface FilterSelectProps {
  defaultValue: string
  options: { value: string; label: string }[]
  paramName: string
  className?: string
  style?: React.CSSProperties
}

export function FilterSelect({ defaultValue, options, paramName, className, style }: FilterSelectProps) {
  return (
    <select
      defaultValue={defaultValue}
      className={className}
      style={style}
      onChange={e => {
        const url = new URL(window.location.href)
        url.searchParams.set(paramName, e.target.value)
        url.searchParams.set('page', '1')
        window.location.href = url.toString()
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

interface SearchInputProps {
  defaultValue?: string
  placeholder?: string
  paramName?: string
  className?: string
  style?: React.CSSProperties
}

export function SearchInput({ defaultValue = '', placeholder = 'Buscar...', paramName = 'q', className, style }: SearchInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target as HTMLInputElement & { _searchTimer?: number }
    clearTimeout(el._searchTimer)
    el._searchTimer = window.setTimeout(() => {
      const url = new URL(window.location.href)
      if (e.target.value) url.searchParams.set(paramName, e.target.value)
      else url.searchParams.delete(paramName)
      url.searchParams.set('page', '1')
      window.location.href = url.toString()
    }, 500)
  }

  return (
    <input
      type="search"
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={handleChange}
      className={className}
      style={style}
    />
  )
}

import { NavigateFunction } from 'react-router-dom'

const API_BASE = '/api'

export async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
  navigate?: NavigateFunction | null
): Promise<T> {
  const token = localStorage.getItem('laiw-token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    localStorage.removeItem('laiw-token')
    if (navigate) {
      navigate('/login')
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }

  return res.json() as Promise<T>
}

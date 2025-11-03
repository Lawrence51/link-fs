export type EventItem = {
  id: number
  title: string
  type: 'expo' | 'concert'
  city: string
  venue: string | null
  address: string | null
  start_date: string
  end_date: string | null
  source_url: string | null
  price_range: string | null
  organizer: string | null
}

export type ListResponse = {
  items: EventItem[]
  total: number
  page: number
  pageSize: number
}

export type VerifyResponse = {
  results: Array<{ id: number; verified: boolean }>
}

const BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

export async function fetchEvents(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.append(k, String(v))
  })
  const res = await fetch(`${BASE_URL}/events?${search.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch events')
  return (await res.json()) as ListResponse
}

export async function triggerSync(city: string) {
  const res = await fetch(`${BASE_URL}/events/sync?city=${encodeURIComponent(city)}`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to sync events')
  return await res.json()
}

export async function verifyEvents(ids: number[]) {
  const res = await fetch(`${BASE_URL}/events/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error('Failed to verify events')
  return (await res.json()) as VerifyResponse
}

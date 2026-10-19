export interface GeoResult {
  name: string
  display: string
  lat: number
  lng: number
}

const cache = new Map<string, GeoResult[]>()
let lastCall = 0

/** Nominatim usage policy: max 1 req/sec, results cached. Browser sends its own Referer. */
export async function searchPlace(q: string): Promise<GeoResult[]> {
  const query = q.trim()
  if (!query) return []
  const hit = cache.get(query)
  if (hit) return hit

  const wait = lastCall + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()

  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=ja&q=' +
    encodeURIComponent(query)
  const res = await fetch(url)
  if (!res.ok) throw new Error('住所検索に失敗しました')
  const json = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string }[]
  const results = json.map((r) => ({
    name: r.name || r.display_name.split(',')[0],
    display: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }))
  cache.set(query, results)
  return results
}

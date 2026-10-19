import type { Category } from '../types'

export interface GeoResult {
  name: string
  display: string
  lat: number
  lng: number
  category: Category
  emoji: string
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    district?: string
    city?: string
    state?: string
    country?: string
    osm_key?: string
    osm_value?: string
  }
}

const cache = new Map<string, GeoResult[]>()

function classify(key = '', value = ''): { category: Category; emoji: string } {
  if (key === 'amenity' && ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court', 'ice_cream'].includes(value))
    return { category: 'food', emoji: '🍴' }
  if (key === 'shop') return { category: 'shop', emoji: '🛍️' }
  if (key === 'tourism' && ['hotel', 'hostel', 'guest_house', 'motel', 'apartment'].includes(value))
    return { category: 'stay', emoji: '🛏️' }
  if (key === 'tourism' || key === 'historic' || (key === 'leisure' && value === 'park'))
    return { category: 'sight', emoji: '📷' }
  return { category: 'other', emoji: '📍' }
}

/**
 * Photon (OSM based, no API key). Supports as-you-type search and location bias.
 * `lang` is intentionally omitted: Photon rejects "ja", and the default returns local (Japanese) names.
 */
export async function searchPlace(
  q: string,
  bias: { lat: number; lng: number } | null,
  signal?: AbortSignal,
): Promise<GeoResult[]> {
  const query = q.trim()
  if (!query) return []

  // Round bias so nearby map positions share cache entries.
  const b = bias ? { lat: +bias.lat.toFixed(2), lng: +bias.lng.toFixed(2) } : null
  const cacheKey = `${query}|${b?.lat},${b?.lng}`
  const hit = cache.get(cacheKey)
  if (hit) return hit

  const [photon, gsi] = await Promise.allSettled([
    searchPhoton(query, b, signal),
    searchGsi(query, signal),
  ])
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  const p = photon.status === 'fulfilled' ? photon.value : []
  const g = gsi.status === 'fulfilled' ? gsi.value : []
  if (photon.status === 'rejected' && gsi.status === 'rejected') throw new Error('場所の検索に失敗しました')

  // Address-like input (prefecture/city suffix or digits): Japanese address results first.
  const addressLike = /[都道府県市区町村郡丁目番地号\d０-９]/.test(query)
  const merged = addressLike ? [...g.slice(0, 5), ...p] : [...p, ...g.slice(0, 3)]
  cache.set(cacheKey, merged)
  return merged
}

/** 国土地理院 address search: free, no key, best for Japanese addresses. */
async function searchGsi(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const res = await fetch(
    `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`,
    { signal },
  )
  if (!res.ok) throw new Error('gsi failed')
  const json = (await res.json()) as {
    geometry: { coordinates: [number, number] }
    properties: { title: string }
  }[]
  return json.map((f) => ({
    name: f.properties.title,
    display: '住所',
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    category: 'other' as Category,
    emoji: '🏠',
  }))
}

async function searchPhoton(
  query: string,
  b: { lat: number; lng: number } | null,
  signal?: AbortSignal,
): Promise<GeoResult[]> {
  const params = new URLSearchParams({ q: query, limit: '8' })
  if (b) {
    params.set('lat', String(b.lat))
    params.set('lon', String(b.lng))
    params.set('location_bias_scale', '0.5')
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal })
  if (!res.ok) throw new Error('photon failed')
  const json = (await res.json()) as { features: PhotonFeature[] }

  return json.features.map((f): GeoResult => {
    const p = f.properties
    const [lng, lat] = f.geometry.coordinates
    const addr = [p.state, p.city, p.district, p.street && p.street + (p.housenumber ?? '')]
      .filter(Boolean)
      .join(' ')
    return {
      name: p.name || p.street || addr || query,
      display: addr || p.country || '',
      lat,
      lng,
      ...classify(p.osm_key, p.osm_value),
    }
  })
}

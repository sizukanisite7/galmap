export type Category = 'food' | 'sight' | 'shop' | 'stay' | 'other'

export interface Pin {
  id: string
  map_id: string
  title: string
  memo: string
  category: Category
  visited: boolean
  lat: number
  lng: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type PinInput = Partial<Pick<Pin, 'id'>> &
  Pick<Pin, 'title' | 'memo' | 'category' | 'visited' | 'lat' | 'lng' | 'created_by'>

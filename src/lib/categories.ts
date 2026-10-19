import type { Category } from '../types'

export const CATEGORIES: { key: Category; label: string; color: string; emoji: string }[] = [
  { key: 'food', label: '飲食', color: '#e8590c', emoji: '🍴' },
  { key: 'sight', label: '観光', color: '#1c7ed6', emoji: '📷' },
  { key: 'shop', label: '買い物', color: '#c2255c', emoji: '🛍️' },
  { key: 'stay', label: '宿泊', color: '#7048e8', emoji: '🛏️' },
  { key: 'other', label: 'その他', color: '#2f9e44', emoji: '📍' },
]

export const categoryOf = (k: Category) => CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[4]

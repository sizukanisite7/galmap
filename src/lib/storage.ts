const NICK_KEY = 'galmap:nickname'
const HIST_KEY = 'galmap:maps'

export interface HistoryItem {
  id: string
  name: string
  openedAt: number
}

export const getNickname = () => localStorage.getItem(NICK_KEY) ?? ''
export const setNickname = (n: string) => localStorage.setItem(NICK_KEY, n.trim().slice(0, 30))

export function getHistory(): HistoryItem[] {
  try {
    const list = JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]') as HistoryItem[]
    return list.sort((a, b) => b.openedAt - a.openedAt)
  } catch {
    return []
  }
}

function saveHistory(list: HistoryItem[]) {
  localStorage.setItem(HIST_KEY, JSON.stringify(list))
}

export function touchHistory(id: string, name: string) {
  const rest = getHistory().filter((h) => h.id !== id)
  saveHistory([{ id, name, openedAt: Date.now() }, ...rest])
}

export function removeHistory(id: string) {
  saveHistory(getHistory().filter((h) => h.id !== id))
}

export function renameHistory(id: string, name: string) {
  saveHistory(getHistory().map((h) => (h.id === id ? { ...h, name } : h)))
}

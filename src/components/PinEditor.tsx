import { useState } from 'react'
import { CATEGORIES } from '../lib/categories'
import type { Pin, PinInput } from '../types'

interface Props {
  initial: Partial<Pin> & { lat: number; lng: number }
  nickname: string
  onSave: (pin: PinInput) => Promise<void> | void
  onCancel: () => void
  onTrash?: () => void
}

export default function PinEditor({ initial, nickname, onSave, onCancel, onTrash }: Props) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [memo, setMemo] = useState(initial.memo ?? '')
  const [category, setCategory] = useState(initial.category ?? 'other')
  const [visited, setVisited] = useState(initial.visited ?? false)
  const [busy, setBusy] = useState(false)
  const isEdit = Boolean(initial.id)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      await onSave({
        id: initial.id,
        title: title.trim(),
        memo,
        category,
        visited,
        lat: initial.lat,
        lng: initial.lng,
        created_by: initial.created_by ?? nickname,
      })
    } finally {
      setBusy(false)
    }
  }

  const gmaps = `https://www.google.com/maps/search/?api=1&query=${initial.lat},${initial.lng}`

  return (
    <div className="modal-back" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{isEdit ? 'ピンを編集' : 'ピンを追加'}</h3>
        <label>
          タイトル
          <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </label>
        <label>
          メモ
          <textarea value={memo} maxLength={2000} rows={4} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <label>
          カテゴリ
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="row">
          <input type="checkbox" checked={visited} onChange={(e) => setVisited(e.target.checked)} />
          訪問済み
        </label>
        {isEdit && (
          <p className="muted">
            登録者: {initial.created_by} ／ <a href={gmaps} target="_blank" rel="noreferrer">地図アプリで開く</a>
          </p>
        )}
        <div className="actions">
          {isEdit && onTrash && (
            <button type="button" className="danger" onClick={onTrash}>
              ゴミ箱へ
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="primary" disabled={busy}>
            保存
          </button>
        </div>
      </form>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listPins, purgePin, restorePin } from '../lib/api'
import { categoryOf } from '../lib/categories'
import type { Pin } from '../types'

export default function Trash() {
  const { mapId = '' } = useParams()
  const [pins, setPins] = useState<Pin[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const all = await listPins(mapId, true)
      setPins(all.filter((p) => p.deleted_at))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [mapId])

  useEffect(() => void load(), [load])

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn()
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="page">
      <p><Link to={`/m/${mapId}`}>← マップへ戻る</Link></p>
      <h2>ゴミ箱</h2>
      <p className="muted">削除から30日経過したピンは自動で完全削除されます。</p>
      {error && <p className="error">{error}</p>}
      <ul className="list">
        {pins.map((p) => (
          <li key={p.id} className="row">
            <span className="grow">
              {categoryOf(p.category).emoji} {p.title}
              <br />
              <small className="muted">削除: {new Date(p.deleted_at!).toLocaleDateString('ja-JP')}</small>
            </span>
            <button onClick={() => run(() => restorePin(mapId, p.id))}>復元</button>
            <button
              className="danger"
              onClick={() => confirm('完全に削除します。元に戻せません。') && run(() => purgePin(mapId, p.id))}
            >
              完全削除
            </button>
          </li>
        ))}
        {pins.length === 0 && <li className="muted">ゴミ箱は空です</li>}
      </ul>
    </div>
  )
}

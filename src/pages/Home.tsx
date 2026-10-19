import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createMap, renameMap } from '../lib/api'
import { isConfigured } from '../lib/supabase'
import { getHistory, removeHistory, renameHistory } from '../lib/storage'
import type { HistoryItem } from '../lib/storage'

export default function Home() {
  const nav = useNavigate()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => setItems(getHistory()), [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const id = await createMap(name.trim())
      nav(`/m/${id}`)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const openUrl = (e: React.FormEvent) => {
    e.preventDefault()
    const m = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    if (m) nav(`/m/${m[0].toLowerCase()}`)
    else setErr('URLからマップIDを読み取れませんでした')
  }

  const rename = async (h: HistoryItem) => {
    const n = prompt('マップ名', h.name)?.trim()
    if (!n) return
    try {
      await renameMap(h.id, n)
      renameHistory(h.id, n)
      setItems(getHistory())
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="page">
      <h1>GalMap</h1>
      {!isConfigured && (
        <p className="error">Supabaseが未設定です。.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。</p>
      )}
      {err && <p className="error">{err}</p>}

      <section>
        <h2>新しいマップを作成</h2>
        <form className="row" onSubmit={create}>
          <input value={name} maxLength={60} placeholder="マップ名(例: 京都旅行)" onChange={(e) => setName(e.target.value)} />
          <button className="primary">作成</button>
        </form>
      </section>

      <section>
        <h2>共有URLで開く</h2>
        <form className="row" onSubmit={openUrl}>
          <input value={url} placeholder="共有URLを貼り付け" onChange={(e) => setUrl(e.target.value)} />
          <button>開く</button>
        </form>
      </section>

      <section>
        <h2>最近のマップ</h2>
        {items.length === 0 && <p className="muted">まだありません</p>}
        <ul className="list">
          {items.map((h) => (
            <li key={h.id} className="row">
              <Link to={`/m/${h.id}`} className="grow">
                {h.name}
              </Link>
              <button onClick={() => rename(h)}>名前変更</button>
              <button
                onClick={() => {
                  if (confirm('この端末の履歴から削除します(マップ自体は消えません)')) {
                    removeHistory(h.id)
                    setItems(getHistory())
                  }
                }}
              >
                履歴から削除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

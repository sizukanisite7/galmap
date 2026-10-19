import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import {
  getMap, listPins, subscribeChanges, trashPin, upsertPin, renameMap,
} from '../lib/api'
import { CATEGORIES, categoryOf } from '../lib/categories'
import { searchPlace, type GeoResult } from '../lib/geocode'
import { getNickname, setNickname, touchHistory } from '../lib/storage'
import PinEditor from '../components/PinEditor'
import type { Category, Pin, PinInput } from '../types'

function pinIcon(p: Pin) {
  const c = categoryOf(p.category)
  return L.divIcon({
    className: '',
    html: `<div class="pin${p.visited ? ' visited' : ''}" style="background:${c.color}"><span>${c.emoji}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) })
  return null
}

function FlyTo({ target }: { target: { lat: number; lng: number; k: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15))
  }, [target, map])
  return null
}

type Sort = 'new' | 'old' | 'title'
type Editing = Partial<Pin> & { lat: number; lng: number }

export default function MapPage() {
  const { mapId = '' } = useParams()
  const [mapName, setMapName] = useState('')
  const [pins, setPins] = useState<Pin[]>([])
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [nickname, setNick] = useState(getNickname())
  const [editing, setEditing] = useState<Editing | null>(null)
  const [fly, setFly] = useState<{ lat: number; lng: number; k: number } | null>(null)
  const [tab, setTab] = useState<'map' | 'list'>('map')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<'all' | Category>('all')
  const [status, setStatus] = useState<'all' | 'todo' | 'done'>('all')
  const [sort, setSort] = useState<Sort>('new')
  const [place, setPlace] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null)
  const sub = useRef<ReturnType<typeof subscribeChanges> | null>(null)

  const reload = useCallback(async () => {
    try {
      setPins(await listPins(mapId))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [mapId])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const m = await getMap(mapId)
        if (!alive) return
        if (!m) return setNotFound(true)
        setMapName(m.name)
        touchHistory(m.id, m.name)
        await reload()
      } catch (e) {
        setError((e as Error).message)
      }
    })()
    sub.current = subscribeChanges(mapId, () => void reload())
    return () => {
      alive = false
      sub.current?.unsubscribe()
    }
  }, [mapId, reload])

  // Debounced address search
  useEffect(() => {
    if (!place.trim()) return setResults([])
    const t = setTimeout(() => {
      searchPlace(place).then(setResults).catch((e) => setError((e as Error).message))
    }, 800)
    return () => clearTimeout(t)
  }, [place])

  const save = async (pin: PinInput) => {
    try {
      await upsertPin(mapId, pin)
      setEditing(null)
      await reload()
      sub.current?.notify()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const trash = async (id: string) => {
    try {
      await trashPin(mapId, id)
      setEditing(null)
      await reload()
      sub.current?.notify()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const needNick = () => {
    if (nickname) return true
    const n = prompt('ニックネームを入力してください(登録者として記録されます)')?.trim()
    if (!n) return false
    setNickname(n)
    setNick(n.slice(0, 30))
    return true
  }

  const startAdd = (lat: number, lng: number, title = '') => {
    if (!needNick()) return
    setEditing({ lat, lng, title })
  }

  const visible = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const list = pins.filter(
      (p) =>
        (cat === 'all' || p.category === cat) &&
        (status === 'all' || (status === 'done') === p.visited) &&
        (!kw || (p.title + ' ' + p.memo).toLowerCase().includes(kw)),
    )
    list.sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title, 'ja')
        : sort === 'old'
          ? a.created_at.localeCompare(b.created_at)
          : b.created_at.localeCompare(a.created_at),
    )
    return list
  }, [pins, q, cat, status, sort])

  const locate = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setMe(p)
        setTab('map')
        setFly({ ...p, k: Date.now() })
      },
      () => setError('現在地を取得できませんでした(位置情報の許可を確認してください)'),
    )
  }

  const share = async () => {
    await navigator.clipboard.writeText(location.href)
    alert('共有URLをコピーしました。このURLを知っている人は誰でも編集できます。')
  }

  const rename = async () => {
    const n = prompt('マップ名', mapName)?.trim()
    if (!n) return
    try {
      await renameMap(mapId, n)
      setMapName(n)
      touchHistory(mapId, n)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ name: mapName, exportedAt: new Date().toISOString(), pins }, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `galmap-${mapName || mapId}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (notFound)
    return (
      <div className="page">
        <p className="error">マップが見つかりません。</p>
        <Link to="/">トップへ</Link>
      </div>
    )

  return (
    <div className="map-page">
      <header className="bar">
        <Link to="/">←</Link>
        <strong className="grow title" onClick={rename}>{mapName}</strong>
        <button onClick={share}>共有</button>
        <button onClick={exportJson}>保存</button>
        <Link to={`/m/${mapId}/trash`}>ゴミ箱</Link>
      </header>
      {error && (
        <p className="error" onClick={() => setError('')}>
          {error}(タップで閉じる)
        </p>
      )}

      <div className="searchbar">
        <input placeholder="場所・住所を検索して追加" value={place} onChange={(e) => setPlace(e.target.value)} />
        <button onClick={locate}>現在地</button>
        {results.length > 0 && (
          <ul className="results">
            {results.map((r, i) => (
              <li
                key={i}
                onClick={() => {
                  setResults([])
                  setPlace('')
                  setTab('map')
                  setFly({ lat: r.lat, lng: r.lng, k: Date.now() })
                  startAdd(r.lat, r.lng, r.name)
                }}
              >
                <b>{r.name}</b>
                <br />
                <small>{r.display}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav className="tabs">
        <button className={tab === 'map' ? 'on' : ''} onClick={() => setTab('map')}>地図</button>
        <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>一覧 ({visible.length})</button>
      </nav>

      <div className={`content show-${tab}`}>
        <div className="map-area">
          <MapContainer center={[35.68, 139.76]} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onClick={(lat, lng) => startAdd(lat, lng)} />
            <FlyTo target={fly} />
            {me && <CircleMarker center={[me.lat, me.lng]} radius={8} pathOptions={{ color: '#1971c2' }} />}
            {visible.map((p) => (
              <Marker
                key={p.id}
                position={[p.lat, p.lng]}
                icon={pinIcon(p)}
                draggable
                eventHandlers={{
                  click: () => setEditing(p),
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng()
                    void save({ ...p, lat: ll.lat, lng: ll.lng })
                  },
                }}
              >
                <Tooltip>{p.title}</Tooltip>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <aside className="list-area">
          <div className="filters">
            <input placeholder="検索" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={cat} onChange={(e) => setCat(e.target.value as 'all' | Category)}>
              <option value="all">全カテゴリ</option>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">すべて</option>
              <option value="todo">未訪問</option>
              <option value="done">訪問済み</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="new">新しい順</option>
              <option value="old">古い順</option>
              <option value="title">名前順</option>
            </select>
          </div>
          <ul className="list">
            {visible.map((p) => {
              const c = categoryOf(p.category)
              return (
                <li key={p.id} className={p.visited ? 'visited' : ''}>
                  <div
                    className="grow"
                    onClick={() => {
                      setTab('map')
                      setFly({ lat: p.lat, lng: p.lng, k: Date.now() })
                    }}
                  >
                    <span style={{ color: c.color }}>{c.emoji}</span> <b>{p.title}</b>
                    <br />
                    <small className="muted">{p.created_by} ・ {new Date(p.created_at).toLocaleDateString('ja-JP')}</small>
                  </div>
                  <button onClick={() => void save({ ...p, visited: !p.visited })}>{p.visited ? '済' : '未'}</button>
                  <button onClick={() => setEditing(p)}>編集</button>
                </li>
              )
            })}
            {visible.length === 0 && <li className="muted">ピンがありません。地図をタップして追加できます。</li>}
          </ul>
        </aside>
      </div>

      {editing && (
        <PinEditor
          initial={editing}
          nickname={nickname}
          onSave={save}
          onCancel={() => setEditing(null)}
          onTrash={editing.id ? () => void trash(editing.id!) : undefined}
        />
      )}
    </div>
  )
}

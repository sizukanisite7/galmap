import { supabase } from './supabase'
import type { Pin, PinInput } from '../types'

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const createMap = (name: string) => rpc<string>('create_map', { p_name: name })

export async function getMap(mapId: string) {
  const rows = await rpc<{ id: string; name: string }[]>('get_map', { p_map_id: mapId })
  return rows[0] ?? null
}

export const renameMap = (mapId: string, name: string) =>
  rpc<void>('rename_map', { p_map_id: mapId, p_name: name })

export const listPins = (mapId: string, includeDeleted = false) =>
  rpc<Pin[]>('list_pins', { p_map_id: mapId, p_include_deleted: includeDeleted })

export const upsertPin = (mapId: string, pin: PinInput) =>
  rpc<Pin>('upsert_pin', { p_map_id: mapId, p_pin: pin })

export const trashPin = (mapId: string, pinId: string) =>
  rpc<void>('trash_pin', { p_map_id: mapId, p_pin_id: pinId })

export const restorePin = (mapId: string, pinId: string) =>
  rpc<void>('restore_pin', { p_map_id: mapId, p_pin_id: pinId })

export const purgePin = (mapId: string, pinId: string) =>
  rpc<void>('purge_pin', { p_map_id: mapId, p_pin_id: pinId })

/** Realtime: broadcast-only "something changed" notification. Data is always refetched via RPC. */
export function subscribeChanges(mapId: string, onChange: () => void) {
  const channel = supabase.channel(`map:${mapId}`)
  channel.on('broadcast', { event: 'pins_changed' }, onChange).subscribe()
  return {
    notify: () => {
      void channel.send({ type: 'broadcast', event: 'pins_changed', payload: {} })
    },
    unsubscribe: () => {
      void supabase.removeChannel(channel)
    },
  }
}

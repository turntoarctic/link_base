/**
 * WS 房间（09 §3–§5）：每页一房，进程内存 Y.Doc；y-protocols 标准二进制帧
 * （首字节 0=sync step1 / 1=sync step2 / 2=update / 3+=awareness 原样转发）。
 * 合入 update → 去抖 500ms 合并写 page_updates（复用 REST push 语义：阈值合并 + 派生对齐）；
 * 最后一人离开强制 flush 并卸载。单实例约束（04 §6），多实例预留见 09 §7。
 */
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { getPageState, pushDoc } from '../services/docs.service.ts'
import { logger } from '../lib/logger.ts'
import type { LinkbaseDb } from '../lib/deps.ts'

/** 客户端适配器：隔离 Bun WebSocket 实现，便于测试注入 */
export interface WsClient {
  userId: string
  send(data: Uint8Array): unknown
}

interface Room {
  clients: Set<WsClient>
  doc: Y.Doc
  pending: Uint8Array[]
  timer: ReturnType<typeof setTimeout> | null
}

const rooms = new Map<string, Room>()
const PERSIST_DEBOUNCE_MS = 500

const roomKey = (wsId: string, pageId: string) => `ws:${wsId}:page:${pageId}`

/** sync 帧：首字节 = 子类型，payload 用 varBytes */
function frame(subType: number, payload?: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, subType)
  if (payload) encoding.writeVarUint8Array(encoder, payload)
  return encoding.toUint8Array(encoder)
}

function broadcast(room: Room, data: Uint8Array, exclude?: WsClient): void {
  for (const client of room.clients) {
    if (client !== exclude) {
      try {
        client.send(data)
      } catch (error) {
        logger.warn({ error }, '[ws] send failed (dead socket)')
      }
    }
  }
}

async function loadRoom(db: LinkbaseDb, wsId: string, pageId: string): Promise<Room> {
  const doc = new Y.Doc()
  const state = await getPageState(db, pageId)
  if (state) Y.applyUpdate(doc, state)
  const room: Room = { clients: new Set(), doc, pending: [], timer: null }
  rooms.set(roomKey(wsId, pageId), room)
  return room
}

function schedulePersist(db: LinkbaseDb, wsId: string, pageId: string, room: Room, actorId: string): void {
  if (room.timer) return
  room.timer = setTimeout(() => {
    room.timer = null
    void flushPersist(db, wsId, pageId, room, actorId)
  }, PERSIST_DEBOUNCE_MS)
}

async function flushPersist(db: LinkbaseDb, wsId: string, pageId: string, room: Room, actorId: string): Promise<void> {
  if (room.pending.length === 0) return
  const merged = room.pending.length === 1 ? room.pending[0]! : Y.mergeUpdates(room.pending)
  room.pending = []
  try {
    await pushDoc(db, pageId, actorId, merged)
  } catch (error) {
    // payload 超限等写失败：重新排队下次 flush（单页 512KB 上限，正常编辑流不会触达）
    room.pending.push(merged)
    logger.error({ error, pageId }, '[ws] persist failed, requeued')
  }
}

/** 进入房间：首客从存储装载（快照+增量，08 §4.1）；并向该客户端发 sync step1 索取差异 */
export async function joinRoom(
  db: LinkbaseDb,
  wsId: string,
  pageId: string,
  client: WsClient,
): Promise<Room> {
  const key = roomKey(wsId, pageId)
  let room = rooms.get(key)
  if (!room) room = await loadRoom(db, wsId, pageId)
  room.clients.add(client)
  client.send(frame(0, Y.encodeStateVector(room.doc)))
  return room
}

/** 离开：末客强制 flush 并卸载内存 doc */
export async function leaveRoom(
  db: LinkbaseDb,
  wsId: string,
  pageId: string,
  client: WsClient,
): Promise<void> {
  const key = roomKey(wsId, pageId)
  const room = rooms.get(key)
  if (!room) return
  room.clients.delete(client)
  if (room.clients.size > 0) return
  rooms.delete(key)
  if (room.timer) clearTimeout(room.timer)
  room.timer = null
  await flushPersist(db, wsId, pageId, room, client.userId)
  room.doc.destroy()
}

/** 房间内消息：step1 回 step2；step2/update 合入 → 广播他人 → 去抖持久化；awareness 原样转发 */
export function handleClientMessage(
  db: LinkbaseDb,
  wsId: string,
  pageId: string,
  client: WsClient,
  data: Uint8Array,
): void {
  const room = rooms.get(roomKey(wsId, pageId))
  if (!room) return
  const decoder = decoding.createDecoder(data)
  const type = decoding.readVarUint(decoder)
  if (type === 0) {
    // sync step1：回 room doc 相对该客户端 SV 的差异（step2）
    const sv = decoding.readVarUint8Array(decoder)
    client.send(frame(1, Y.encodeStateAsUpdate(room.doc, sv)))
    return
  }
  if (type === 1 || type === 2) {
    // sync step2 / update：合入内存 doc → 广播他人 → 去抖落库
    const update = decoding.readVarUint8Array(decoder)
    Y.applyUpdate(room.doc, update)
    broadcast(room, frame(2, update), client)
    room.pending.push(update)
    schedulePersist(db, wsId, pageId, room, client.userId)
    return
  }
  // awareness（3+）：光标/选区/在线状态，服务端不解析，原样转发房间其他人
  broadcast(room, data, client)
}

/**
 * WS provider（09 §6，T2.1）：内容实时互见（awareness/光标属 T2.2）。
 * 连接 → sync step1/2 全量对齐 → 本地 update 即时帧发；远端回放带 remoteOrigin，
 * REST 推送与 BC 广播自动跳过。REST 去抖推送保留作兜底（Yjs update 幂等，双通道无冲突）。
 * 断线重连：指数退避（1s → 15s 封顶），重连重新取票 + 全量对齐。
 */
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { api, getAccessToken } from '@/lib/fetch'
import { remoteOrigin, type RemoteOrigin } from './sync-origin'

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 15_000

export interface WsRelay {
  destroy(): void
}

function frame(subType: number, payload?: Uint8Array): Uint8Array<ArrayBuffer> {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, subType)
  if (payload) encoding.writeVarUint8Array(encoder, payload)
  // lib0 产出的 ArrayBufferLike 收窄为可发送的 ArrayBuffer 视图
  return encoding.toUint8Array(encoder) as Uint8Array<ArrayBuffer>
}

export function startWsRelay(
  wsId: string,
  pageId: string,
  ydoc: Y.Doc,
  remoteOrigin: RemoteOrigin,
): WsRelay {
  let ws: WebSocket | null = null
  let closed = false
  let attempts = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const sendNow = (subType: number, payload?: Uint8Array): void => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(frame(subType, payload))
  }

  async function connect(): Promise<void> {
    if (closed) return
    if (!getAccessToken()) {
      scheduleReconnect()
      return
    }
    let ticket: string
    try {
      const res = await api.json<{ ticket: string }>('/ws/ticket', { method: 'POST' })
      ticket = res.ticket
    } catch {
      scheduleReconnect()
      return
    }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(
      `${proto}//${location.host}/ws?ticket=${encodeURIComponent(ticket)}&workspaceId=${encodeURIComponent(wsId)}&pageId=${encodeURIComponent(pageId)}`,
    )
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      attempts = 0
      sendNow(0, Y.encodeStateVector(ydoc))
    }
    ws.onmessage = (ev) => {
      const data = new Uint8Array(ev.data as ArrayBuffer)
      const decoder = decoding.createDecoder(data)
      const type = decoding.readVarUint(decoder)
      if (type === 0) {
        // 服务端索取差异：回 step2
        const sv = decoding.readVarUint8Array(decoder)
        sendNow(1, Y.encodeStateAsUpdate(ydoc, sv))
      } else if (type === 1 || type === 2) {
        Y.applyUpdate(ydoc, decoding.readVarUint8Array(decoder), remoteOrigin)
      }
    }
    ws.onclose = () => {
      ws = null
      scheduleReconnect()
    }
    ws.onerror = () => {} // onclose 会跟进
  }

  function scheduleReconnect(): void {
    if (closed || retryTimer) return
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempts, RECONNECT_MAX_MS)
    attempts += 1
    retryTimer = setTimeout(() => {
      retryTimer = null
      void connect()
    }, delay)
  }

  const onUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === remoteOrigin) return // 远端回放不回发
    sendNow(2, update)
  }
  ydoc.on('update', onUpdate)

  void connect()

  return {
    destroy() {
      closed = true
      if (retryTimer) clearTimeout(retryTimer)
      ydoc.off('update', onUpdate)
      if (ws) {
        ws.onclose = null
        ws.close()
      }
      ws = null
    },
  }
}

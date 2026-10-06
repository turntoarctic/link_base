/**
 * /ws 升级（09 §2）：升级前校验票据（取出即焚）→ 空间成员 → 页面归属与非回收态；
 * 失败按 close code 拒绝：4001 票据无效 / 4003 无权限 / 4004 页面不存在。
 * 心跳：服务端 25s 协议层 ping（浏览器自动 pong），死连接由 TCP 错误触发 close。
 */
import { and, eq } from 'drizzle-orm'
import type { ServerWebSocket } from 'bun'
import type { ServerDeps } from '../lib/deps.ts'
import { pages, workspaceMembers } from '../db/index.ts'
import { handleClientMessage, joinRoom, leaveRoom, type WsClient } from './rooms.ts'

export interface WsData {
  reject: number
  userId: string
  wsId: string
  pageId: string
  client?: WsClient
}

type WsSocket = ServerWebSocket<WsData>

export function createWsHandlers(deps: ServerDeps) {
  async function validate(
    wsId: string,
    pageId: string,
    ticket: string,
  ): Promise<{ reject: number; userId: string }> {
    if (!ticket) return { reject: 4001, userId: '' }
    const userId = await deps.sessions.takeWsTicket(ticket)
    if (!userId) return { reject: 4001, userId: '' }
    const member = await deps.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, userId)))
      .limit(1)
    if (!member[0]) return { reject: 4003, userId: '' }
    const page = await deps.db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.id, pageId), eq(pages.workspaceId, wsId), eq(pages.isTrash, false)))
      .limit(1)
    if (!page[0]) return { reject: 4004, userId: '' }
    return { reject: 0, userId }
  }

  async function handleUpgrade(req: Request, server: { upgrade(req: Request, options?: { data?: unknown }): boolean }): Promise<Response | undefined> {
    const url = new URL(req.url)
    const { reject, userId } = await validate(
      url.searchParams.get('workspaceId') ?? '',
      url.searchParams.get('pageId') ?? '',
      url.searchParams.get('ticket') ?? '',
    )
    const data: WsData = {
      reject,
      userId,
      wsId: url.searchParams.get('workspaceId') ?? '',
      pageId: url.searchParams.get('pageId') ?? '',
    }
    if (!server.upgrade(req, { data })) {
      return new Response('WebSocket upgrade failed', { status: 400 })
    }
    return undefined
  }

  const websocket = {
    open(ws: WsSocket): void {
      const d = ws.data
      if (d.reject) {
        ws.close(d.reject, 'rejected')
        return
      }
      const client: WsClient = {
        userId: d.userId,
        send: (data) => ws.send(data),
      }
      d.client = client
      void joinRoom(deps.db, d.wsId, d.pageId, client)
    },
    message(ws: WsSocket, message: string | Buffer): void {
      const d = ws.data
      if (d.reject || !d.client) return
      handleClientMessage(deps.db, d.wsId, d.pageId, d.client, new Uint8Array(message as Buffer))
    },
    close(ws: WsSocket): void {
      const d = ws.data
      if (d.reject || !d.client) return
      void leaveRoom(deps.db, d.wsId, d.pageId, d.client)
    },
  }

  return { handleUpgrade, websocket }
}

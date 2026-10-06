/**
 * WS 房间集成测试（09 §8，DB 门控）：真实 Bun.serve + Bun WebSocket 客户端。
 * 覆盖：4001 无效票据 / 4003 非成员 / 用例 1（双端实时同步）/ 去抖落库。
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { createDb, pages, workspaceMembers } from '@linkbase/database'
import { extractPageMeta } from '@linkbase/ydoc'
import { getPageState } from '../../src/services/docs.service.ts'
import { createApp } from '../../src/app.ts'
import { createKV, createSessions } from '../../src/db/redis.ts'
import { createWsHandlers } from '../../src/ws/handler.ts'

process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef'
process.env.DATABASE_URL ??= ''
process.env.APP_ORIGIN ??= 'http://localhost:5173'

const HAS_DB = Boolean(process.env.DATABASE_URL)
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function frame(subType: number, payload?: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, subType)
  if (payload) encoding.writeVarUint8Array(encoder, payload)
  return encoding.toUint8Array(encoder) as Uint8Array<ArrayBuffer>
}

function waitClose(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    ws.addEventListener('close', (ev) => resolve(ev.code), { once: true })
  })
}

function connectTestClient(url: string): Promise<{
  doc: Y.Doc
  send(subType: number, payload?: Uint8Array): void
  close(): void
  waitFor(pred: (doc: Y.Doc) => boolean, ms?: number): Promise<void>
}> {
  return new Promise((resolve, reject) => {
    const doc = new Y.Doc()
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    const timer = setTimeout(() => reject(new Error('ws connect timeout')), 5000)
    ws.onopen = () => {
      clearTimeout(timer)
      // 客户端主动 step1：索取服务端缺失内容
      ws.send(frame(0, Y.encodeStateVector(doc)))
      resolve({
        doc,
        send: (subType, payload) => ws.send(frame(subType, payload)),
        close: () => ws.close(),
        waitFor: (pred, ms = 5000) =>
          new Promise((res, rej) => {
            const check = () => {
              if (pred(doc)) {
                cleanup()
                res()
              }
            }
            const onChange = () => check()
            const failTimer = setTimeout(() => {
              cleanup()
              rej(new Error('waitFor timeout'))
            }, ms)
            const cleanup = () => clearTimeout(failTimer)
            doc.on('update', onChange)
            check()
          }),
      })
    }
    ws.onmessage = (ev) => {
      const data = new Uint8Array(ev.data as ArrayBuffer)
      const decoder = decoding.createDecoder(data)
      const type = decoding.readVarUint(decoder)
      if (type === 0) {
        // 服务端 step1：回本地差异（step2）
        const sv = decoding.readVarUint8Array(decoder)
        ws.send(frame(1, Y.encodeStateAsUpdate(doc, sv)))
      } else if (type === 1 || type === 2) {
        Y.applyUpdate(doc, decoding.readVarUint8Array(decoder))
      }
    }
  })
}

describe.skipIf(!HAS_DB)('WS 房间（09 §8）', () => {
  let base = ''
  let app: ReturnType<typeof createApp>
  let db: ReturnType<typeof createDb>
  let closeServer: () => void = () => {}
  let wsId = ''
  let pageId = ''
  const tokens = new Map<string, string>()

  beforeAll(async () => {
    db = createDb(process.env.DATABASE_URL!)
    const kv = createKV('')
    const deps = { db, kv, sessions: createSessions(kv), appOrigin: 'http://localhost:5173' }
    app = createApp(deps)
    const handlers = createWsHandlers(deps)
    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => {
        const url = new URL(req.url)
        if (url.pathname === '/ws') return handlers.handleUpgrade(req, server)
        return app.fetch(req, server)
      },
      websocket: handlers.websocket,
    })
    base = `http://localhost:${server.port}`
    closeServer = () => server.stop(true)

    const suffix = unique()
    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `ws-owner-${suffix}@test.dev`, password: 'password123', name: 'Owner' }),
    })
    const owner = (await reg.json()) as { accessToken: string; workspace: { id: string }; user: { id: string } }
    tokens.set('owner', owner.accessToken)
    wsId = owner.workspace.id
    const h = { authorization: `Bearer ${owner.accessToken}` }
    const page = await app.request(`/api/workspaces/${wsId}/pages`, {
      method: 'POST',
      headers: { ...h, 'content-type': 'application/json' },
      body: '{}',
    })
    pageId = ((await page.json()) as { id: string }).id

    const member = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `ws-member-${suffix}@test.dev`, password: 'password123', name: 'Member' }),
    })
    const memberBody = (await member.json()) as { accessToken: string; user: { id: string } }
    tokens.set('member', memberBody.accessToken)
    await db.insert(workspaceMembers).values({ workspaceId: wsId, userId: memberBody.user.id, role: 'member' })
  })

  const ticket = async (who: 'owner' | 'member'): Promise<string> => {
    const res = await app.request('/api/ws/ticket', {
      method: 'POST',
      headers: { authorization: `Bearer ${tokens.get(who)}` },
    })
    expect(res.status).toBe(201)
    return ((await res.json()) as { ticket: string }).ticket
  }

  test('4001：无效票据拒绝', async () => {
    const ws = new WebSocket(`ws://${base.replace('http://', '')}/ws?ticket=bogus&workspaceId=${wsId}&pageId=${pageId}`)
    expect(await waitClose(ws)).toBe(4001)
  })

  test('4003：非成员拒绝', async () => {
    const suffix = unique()
    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `ws-outsider-${suffix}@test.dev`, password: 'password123', name: 'Outsider' }),
    })
    const outsider = (await reg.json()) as { accessToken: string }
    const t = await app.request('/api/ws/ticket', {
      method: 'POST',
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    })
    const { ticket: outsiderTicket } = (await t.json()) as { ticket: string }
    const ws = new WebSocket(`ws://${base.replace('http://', '')}/ws?ticket=${outsiderTicket}&workspaceId=${wsId}&pageId=${pageId}`)
    expect(await waitClose(ws)).toBe(4003)
  })

  test('用例 1：双端实时同步 + 去抖落库', async () => {
    const a = await connectTestClient(`ws://${base.replace('http://', '')}/ws?ticket=${await ticket('owner')}&workspaceId=${wsId}&pageId=${pageId}`)
    // A 本地输入 → update 帧即时上行
    const p = new Y.XmlElement('paragraph')
    const t = new Y.XmlText()
    t.insert(0, '实时协作文本')
    p.insert(0, [t])
    a.doc.getXmlFragment('default').insert(a.doc.getXmlFragment('default').length, [p])
    a.send(2, Y.encodeStateAsUpdate(a.doc))

    // B 后连：step1 索取 → 服务端 step2 下发全量差异
    const b = await connectTestClient(`ws://${base.replace('http://', '')}/ws?ticket=${await ticket('member')}&workspaceId=${wsId}&pageId=${pageId}`)
    await b.waitFor((d) => d.getXmlFragment('default').toJSON().includes('实时协作文本'))
    expect(b.doc.getXmlFragment('default').toJSON()).toContain('实时协作文本')

    // 去抖 500ms 落库：合并状态含 A 的文本
    await new Promise((r) => setTimeout(r, 900))
    const state = await getPageState(db, pageId)
    expect(state).not.toBeNull()
    expect(extractPageMeta(state!).text).toContain('实时协作文本')

    // 行归属未受影响
    const rows = await db.select({ workspaceId: pages.workspaceId }).from(pages).where(eq(pages.id, pageId))
    expect(rows[0]?.workspaceId).toBe(wsId)

    a.close()
    b.close()
    closeServer()
  })
})

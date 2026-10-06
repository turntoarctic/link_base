/**
 * 公开分享集成测试（Phase 3 立项，DB 门控）：
 * 开启 → slug → 公开无鉴权拉取含内容；关闭 → 404；非成员 403；内容更新后公开拉取同步。
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import * as Y from 'yjs'
import { createDb } from '@linkbase/database'
import { closeTrackedDbs, trackDb } from '../helpers/test-db.ts'
import { createApp } from '../../src/app.ts'
import { createKV, createSessions } from '../../src/db/redis.ts'
import { markdownToYDoc } from '@linkbase/ydoc'

process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef'
process.env.DATABASE_URL ??= ''
process.env.APP_ORIGIN ??= 'http://localhost:5173'

const HAS_DB = Boolean(process.env.DATABASE_URL)
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(!HAS_DB)('公开分享（Phase 3）', () => {
  let app: ReturnType<typeof createApp>
  let ownerH: Record<string, string>
  let outsiderH: Record<string, string>
  let ws = ''
  let pageId = ''

  beforeAll(async () => {
    const db = trackDb(createDb(process.env.DATABASE_URL!))
    const kv = createKV('')
    app = createApp({ db, kv, sessions: createSessions(kv), appOrigin: 'http://localhost:5173' })

    const owner = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `share-owner-${unique()}@test.dev`, password: 'password123', name: 'Owner' }),
    })
    const ownerBody = (await owner.json()) as { accessToken: string; workspace: { id: string } }
    ownerH = { authorization: `Bearer ${ownerBody.accessToken}`, 'content-type': 'application/json' }
    ws = ownerBody.workspace.id

    const outsider = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `share-out-${unique()}@test.dev`, password: 'password123', name: 'Out' }),
    })
    outsiderH = { authorization: `Bearer ${((await outsider.json()) as { accessToken: string }).accessToken}`, 'content-type': 'application/json' }

    const page = await app.request(`/api/workspaces/${ws}/pages`, { method: 'POST', headers: ownerH, body: '{}' })
    pageId = ((await page.json()) as { id: string }).id
    await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, {
      method: 'POST',
      headers: { ...ownerH, 'content-type': 'application/octet-stream' },
      body: Y.encodeStateAsUpdate(markdownToYDoc('# 公开页\n\n分享内容正文')),
    })
  })

  afterAll(async () => {
    await closeTrackedDbs()
  })

  test('未开启时公开拉取 404', async () => {
    // 先开再关，拿到一个已知 slug
    const on = await app.request(`/api/workspaces/${ws}/pages/${pageId}/share`, {
      method: 'POST', headers: ownerH, body: JSON.stringify({ enabled: true }),
    })
    const { slug } = (await on.json()) as { slug: string }
    expect(slug).toBeTruthy()
    const off = await app.request(`/api/workspaces/${ws}/pages/${pageId}/share`, {
      method: 'POST', headers: ownerH, body: JSON.stringify({ enabled: false }),
    })
    expect(off.status).toBe(204)
    const res = await app.request(`/api/share/${slug}`)
    expect(res.status).toBe(404)
  })

  test('非成员尝试开启 403', async () => {
    const res = await app.request(`/api/workspaces/${ws}/pages/${pageId}/share`, {
      method: 'POST', headers: outsiderH, body: JSON.stringify({ enabled: true }),
    })
    expect(res.status).toBe(403)
  })

  test('开启 → 公开无鉴权拉取（内容完整）→ 内容更新后同步', async () => {
    const on = await app.request(`/api/workspaces/${ws}/pages/${pageId}/share`, {
      method: 'POST', headers: ownerH, body: JSON.stringify({ enabled: true }),
    })
    expect(on.status).toBe(200)
    const { slug } = (await on.json()) as { slug: string }

    const res = await app.request(`/api/share/${slug}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('octet-stream')
    const doc = new Y.Doc()
    Y.applyUpdate(doc, new Uint8Array(await res.arrayBuffer()))
    expect(doc.getXmlFragment('default').toJSON()).toContain('分享内容正文')

    // 内容更新（追加）→ 公开拉取同步
    const pulled = await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, { headers: ownerH })
    const local = new Y.Doc()
    Y.applyUpdate(local, new Uint8Array(await pulled.arrayBuffer()))
    const p = new Y.XmlElement('paragraph')
    const t = new Y.XmlText()
    t.insert(0, '更新追加的一行')
    p.insert(0, [t])
    local.getXmlFragment('default').insert(local.getXmlFragment('default').length, [p])
    await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, {
      method: 'POST',
      headers: { ...ownerH, 'content-type': 'application/octet-stream' },
      body: Y.encodeStateAsUpdate(local),
    })
    const res2 = await app.request(`/api/share/${slug}`)
    const doc2 = new Y.Doc()
    Y.applyUpdate(doc2, new Uint8Array(await res2.arrayBuffer()))
    expect(doc2.getXmlFragment('default').toJSON()).toContain('更新追加的一行')

    // 重开 slug 不变
    const again = await app.request(`/api/workspaces/${ws}/pages/${pageId}/share`, {
      method: 'POST', headers: ownerH, body: JSON.stringify({ enabled: true }),
    })
    expect(((await again.json()) as { slug: string }).slug).toBe(slug)
  })
})

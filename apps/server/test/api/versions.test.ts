/**
 * 版本历史集成测试（08 §4.5 / T2.3，DB 门控）：
 * push 内容 → 手动存版本 → 追加内容 → 时间线/正文 → 恢复 → 旧内容回归（CRDT 合并）+ restore 快照。
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { desc, eq } from 'drizzle-orm'
import * as Y from 'yjs'
import { createDb, pageSnapshots } from '@linkbase/database'
import { closeTrackedDbs, trackDb } from '../helpers/test-db.ts'
import { createApp } from '../../src/app.ts'
import { createKV, createSessions } from '../../src/db/redis.ts'

process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef'
process.env.DATABASE_URL ??= ''
process.env.APP_ORIGIN ??= 'http://localhost:5173'

const HAS_DB = Boolean(process.env.DATABASE_URL)
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/** 向页面写一段文本（走 REST push，内容单写者语义同客户端） */
async function pushText(app: ReturnType<typeof createApp>, h: Record<string, string>, ws: string, pageId: string, text: string): Promise<void> {
  const ydoc = new Y.Doc()
  // 先拉全量（幂等，直接在最新状态上追加）
  const pulled = await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, { headers: h })
  if (pulled.status === 200) Y.applyUpdate(ydoc, new Uint8Array(await pulled.arrayBuffer()))
  const p = new Y.XmlElement('paragraph')
  const t = new Y.XmlText()
  t.insert(0, text)
  p.insert(0, [t])
  ydoc.getXmlFragment('default').insert(ydoc.getXmlFragment('default').length, [p])
  const res = await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, {
    method: 'POST',
    headers: { ...h, 'content-type': 'application/octet-stream' },
    body: Y.encodeStateAsUpdate(ydoc),
  })
  expect(res.status).toBe(204)
}

describe.skipIf(!HAS_DB)('版本历史（08 §4.5 / T2.3）', () => {
  let app: ReturnType<typeof createApp>
  let db: ReturnType<typeof createDb>
  let h: Record<string, string>
  let ws = ''
  let pageId = ''

  beforeAll(async () => {
    db = trackDb(createDb(process.env.DATABASE_URL!))
    const kv = createKV('')
    app = createApp({ db, kv, sessions: createSessions(kv), appOrigin: 'http://localhost:5173' })

    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `ver-${unique()}@test.dev`, password: 'password123', name: 'Ver' }),
    })
    const auth = (await reg.json()) as { accessToken: string; workspace: { id: string } }
    h = { authorization: `Bearer ${auth.accessToken}` }
    ws = auth.workspace.id
    const page = await app.request(`/api/workspaces/${ws}/pages`, {
      method: 'POST',
      headers: { ...h, 'content-type': 'application/json' },
      body: '{}',
    })
    pageId = ((await page.json()) as { id: string }).id
  })

  afterAll(async () => {
    await closeTrackedDbs()
  })

  test('手动保存 → 时间线 → 恢复 → 旧内容回归 + restore 快照', async () => {
    await pushText(app, h, ws, pageId, '版本甲的正文内容')

    // 手动存版本 v1
    const save = await app.request(`/api/workspaces/${ws}/pages/${pageId}/versions`, {
      method: 'POST',
      headers: h,
    })
    expect(save.status).toBe(201)
    const { version } = (await save.json()) as { version: number }
    expect(version).toBeGreaterThanOrEqual(1)

    // 追加新内容（不存版本）
    await pushText(app, h, ws, pageId, '版本乙的追加内容')

    // 时间线：含 manual 条目，excerpt 命中旧文本
    const list = await app.request(`/api/workspaces/${ws}/pages/${pageId}/versions`, { headers: h })
    expect(list.status).toBe(200)
    const items = (await list.json()) as Array<{ version: number; reason: string; excerpt: string }>
    const manual = items.find((i) => i.version === version)
    expect(manual?.reason).toBe('manual')
    expect(manual?.excerpt).toContain('版本甲')

    // 版本正文端点
    const text = await app.request(`/api/workspaces/${ws}/pages/${pageId}/versions/${version}`, { headers: h })
    expect(((await text.json()) as { text: string }).text).toContain('版本甲')

    // 恢复到 v1：旧内容回归；CRDT 合并语义下并发内容仍在
    const restore = await app.request(`/api/workspaces/${ws}/pages/${pageId}/versions/${version}/restore`, {
      method: 'POST',
      headers: h,
    })
    expect(restore.status).toBe(204)

    const pulled = await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, { headers: h })
    const doc = new Y.Doc()
    Y.applyUpdate(doc, new Uint8Array(await pulled.arrayBuffer()))
    const all = doc.getXmlFragment('default').toJSON()
    expect(all).toContain('版本甲的正文内容')
    expect(all).toContain('版本乙的追加内容')

    // 恢复点快照：最新一条 reason=restore
    const snaps = await db
      .select()
      .from(pageSnapshots)
      .where(eq(pageSnapshots.pageId, pageId))
      .orderBy(desc(pageSnapshots.version))
      .limit(1)
    expect(snaps[0]?.reason).toBe('restore')
  })

  test('空版本号参数 404', async () => {
    const res = await app.request(`/api/workspaces/${ws}/pages/${pageId}/versions/99999`, { headers: h })
    expect(res.status).toBe(404)
  })
})


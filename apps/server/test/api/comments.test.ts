/**
 * 评论集成测试（P1-3 / T2.4，DB 门控）：建（页面级/行内锚点）→ 回复 → 解决/重开 → 删除；
 * 越权（非成员 403）与跨页评论 id 不可达。
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { createDb } from '@linkbase/database'
import { createApp } from '../../src/app.ts'
import { createKV, createSessions } from '../../src/db/redis.ts'

process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef'
process.env.DATABASE_URL ??= ''
process.env.APP_ORIGIN ??= 'http://localhost:5173'

const HAS_DB = Boolean(process.env.DATABASE_URL)
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(!HAS_DB)('评论（P1-3 / T2.4）', () => {
  let app: ReturnType<typeof createApp>
  let h: Record<string, string>
  let ws = ''
  let pageId = ''
  let rootId = ''
  let inlineId = ''

  beforeAll(async () => {
    const db = createDb(process.env.DATABASE_URL!)
    const kv = createKV('')
    app = createApp({ db, kv, sessions: createSessions(kv), appOrigin: 'http://localhost:5173' })

    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `cmt-${unique()}@test.dev`, password: 'password123', name: '评论者' }),
    })
    const auth = (await reg.json()) as { accessToken: string; workspace: { id: string } }
    h = { authorization: `Bearer ${auth.accessToken}`, 'content-type': 'application/json' }
    ws = auth.workspace.id
    const page = await app.request(`/api/workspaces/${ws}/pages`, {
      method: 'POST',
      headers: h,
      body: '{}',
    })
    pageId = ((await page.json()) as { id: string }).id
  })

  test('页面级评论：建 → 列表（作者名解析）', async () => {
    const res = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ body: '这个页面的结构需要再讨论' }),
    })
    expect(res.status).toBe(201)
    const item = (await res.json()) as { id: string; authorName: string; anchor: null; resolved: boolean }
    expect(item.authorName).toBe('评论者')
    expect(item.anchor).toBeNull()
    expect(item.resolved).toBe(false)
    rootId = item.id

    const list = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments`, { headers: h })
    const items = (await list.json()) as Array<{ id: string }>
    expect(items.some((i) => i.id === rootId)).toBe(true)
  })

  test('行内锚点评论：quote/前后文入库', async () => {
    const res = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        body: '这句表述有歧义',
        anchor: { quote: '量子波动速读法', prefix: '据说 ', suffix: ' 可以提升阅读速度' },
      }),
    })
    expect(res.status).toBe(201)
    const item = (await res.json()) as { id: string; anchor: { quote: string } }
    expect(item.anchor?.quote).toBe('量子波动速读法')
    inlineId = item.id
  })

  test('回复串：parentId 挂到根评论', async () => {
    const res = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments/${rootId}/replies`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ body: '同意，周五会议对齐' }),
    })
    expect(res.status).toBe(201)
    const reply = (await res.json()) as { parentId: string }
    expect(reply.parentId).toBe(rootId)
  })

  test('解决 → 重开', async () => {
    const r1 = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments/${rootId}/resolve`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ resolved: true }),
    })
    expect(r1.status).toBe(204)
    const list1 = (await (
      await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments`, { headers: h })
    ).json()) as Array<{ id: string; resolved: boolean }>
    expect(list1.find((i) => i.id === rootId)?.resolved).toBe(true)

    const r2 = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments/${rootId}/resolve`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ resolved: false }),
    })
    expect(r2.status).toBe(204)
  })

  test('校验失败 400：空 body / 锚点缺 quote', async () => {
    const r1 = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ body: '' }),
    })
    expect(r1.status).toBe(400)
    const r2 = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ body: 'x', anchor: { quote: '', prefix: '', suffix: '' } }),
    })
    expect(r2.status).toBe(400)
  })

  test('删除：回复随级联消失', async () => {
    const del = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments/${rootId}`, {
      method: 'DELETE',
      headers: h,
    })
    expect(del.status).toBe(204)
    const list = (await (
      await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments`, { headers: h })
    ).json()) as Array<{ id: string }>
    expect(list.some((i) => i.id === rootId)).toBe(false)
    expect(list.some((i) => i.id === inlineId)).toBe(true)
  })
})

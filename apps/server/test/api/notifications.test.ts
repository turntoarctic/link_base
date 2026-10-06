/**
 * 通知集成测试（P1-9 / T2.9，DB 门控）：
 * 评论 → 页面创建者收通知；回复 → 根评论作者收通知；提及（派生触发）→ 去重；
 * 已读/全部已读。
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import * as Y from 'yjs'
import { eq } from 'drizzle-orm'
import { createDb, workspaceMembers } from '@linkbase/database'
import { closeTrackedDbs, trackDb } from '../helpers/test-db.ts'
import { createApp } from '../../src/app.ts'
import { createKV, createSessions } from '../../src/db/redis.ts'
import { mergePage } from '../../src/services/docs.service.ts'

process.env.JWT_SECRET ??= 'test-secret-0123456789abcdef'
process.env.DATABASE_URL ??= ''
process.env.APP_ORIGIN ??= 'http://localhost:5173'

const HAS_DB = Boolean(process.env.DATABASE_URL)
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(!HAS_DB)('通知（P1-9 / T2.9）', () => {
  let app: ReturnType<typeof createApp>
  let db: ReturnType<typeof createDb>
  let ownerH: Record<string, string>
  let memberH: Record<string, string>
  let ownerUserId = ''
  let memberUserId = ''
  let ws = ''
  let pageId = ''

  afterAll(async () => {
    await closeTrackedDbs()
  })

  beforeAll(async () => {
    db = trackDb(createDb(process.env.DATABASE_URL!))
    const kv = createKV('')
    app = createApp({ db, kv, sessions: createSessions(kv), appOrigin: 'http://localhost:5173' })

    const owner = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `ntf-owner-${unique()}@test.dev`, password: 'password123', name: '页主' }),
    })
    if (owner.status !== 201) console.log('OWNER REGISTER FAIL:', owner.status, await owner.text())
    const ownerBody = (await owner.json()) as { accessToken: string; workspace: { id: string }; user: { id: string } }
    ownerH = { authorization: `Bearer ${ownerBody.accessToken}`, 'content-type': 'application/json' }
    ownerUserId = ownerBody.user.id
    ws = ownerBody.workspace.id

    const member = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `ntf-member-${unique()}@test.dev`, password: 'password123', name: '成员' }),
    })
    const memberBody = (await member.json()) as { accessToken: string; user: { id: string } }
    memberH = { authorization: `Bearer ${memberBody.accessToken}`, 'content-type': 'application/json' }
    memberUserId = memberBody.user.id
    await db.insert(workspaceMembers).values({ workspaceId: ws, userId: memberBody.user.id, role: 'member' })

    const page = await app.request(`/api/workspaces/${ws}/pages`, { method: 'POST', headers: ownerH, body: '{}' })
    pageId = ((await page.json()) as { id: string }).id
  })

  const notificationsOf = async (who: 'owner' | 'member'): Promise<Array<{ id: string; type: string; read: boolean; actorName?: string }>> => {
    const headers = who === 'owner' ? ownerH : memberH
    const res = await app.request('/api/notifications', { headers })
    expect(res.status).toBe(200)
    return (await res.json()) as Array<{ id: string; type: string; read: boolean; actorName?: string }>
  }

  test('评论 → 页面创建者收通知（成员不自通知）', async () => {
    const res = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments`, {
      method: 'POST',
      headers: memberH,
      body: JSON.stringify({ body: '这里需要补充说明' }),
    })
    expect(res.status).toBe(201)

    const ownerItems = await notificationsOf('owner')
    const hit = ownerItems.find((n) => n.type === 'comment')
    expect(hit).toBeDefined()
    expect(hit!.read).toBe(false)

    const memberItems = await notificationsOf('member')
    expect(memberItems.some((n) => n.type === 'comment')).toBe(false)
  })

  test('回复 → 根评论作者（页主）收 reply 通知', async () => {
    const list = (await (
      await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments`, { headers: memberH })
    ).json()) as Array<{ id: string }>
    const rootId = list[0]!.id

    const res = await app.request(`/api/workspaces/${ws}/pages/${pageId}/comments/${rootId}/replies`, {
      method: 'POST',
      headers: ownerH,
      body: JSON.stringify({ body: '已补充，谢谢指出' }),
    })
    expect(res.status).toBe(201)

    const memberItems = await notificationsOf('member')
    const hit = memberItems.find((n) => n.type === 'reply')
    expect(hit).toBeDefined()
  })

  test('提及：派生触发 + 同页未读去重', async () => {
    // 成员推送含 mention（指向页主）的文档 → 手动合并（带 actor）触发
    const ydoc = new Y.Doc()
    const p = new Y.XmlElement('paragraph')
    const text = new Y.XmlText()
    text.insert(0, '请 ')
    // mention 是元素节点（inline node），不是文本属性
    const mention = new Y.XmlElement('mention')
    mention.setAttribute('userId', ownerUserId)
    mention.setAttribute('label', '页主')
    p.insert(0, [text, mention])
    ydoc.getXmlFragment('default').insert(0, [p])
    await app.request(`/api/workspaces/${ws}/pages/${pageId}/doc`, {
      method: 'POST',
      headers: { ...memberH, 'content-type': 'application/octet-stream' },
      body: Y.encodeStateAsUpdate(ydoc),
    })
    await mergePage(db, pageId, 'auto', memberUserId)

    const ownerItems1 = await notificationsOf('owner')
    const mentions1 = ownerItems1.filter((n) => n.type === 'mention')
    expect(mentions1.length).toBe(1)

    // 第二次合并：无新增增量不重复通知
    await mergePage(db, pageId, 'auto', memberUserId)
    const ownerItems2 = await notificationsOf('owner')
    expect(ownerItems2.filter((n) => n.type === 'mention').length).toBe(1)
  })

  test('已读与全部已读', async () => {
    const items = await notificationsOf('owner')
    expect(items.length).toBeGreaterThan(0)
    const unreadBefore = items.filter((n) => !n.read).length
    expect(unreadBefore).toBeGreaterThan(0)

    const res = await app.request(`/api/notifications/${items[0]!.id}/read`, {
      method: 'POST',
      headers: ownerH,
    })
    expect(res.status).toBe(204)
    const afterOne = await notificationsOf('owner')
    expect(afterOne.filter((n) => !n.read).length).toBe(unreadBefore - 1)

    const resAll = await app.request('/api/notifications/read-all', { method: 'POST', headers: ownerH })
    expect(resAll.status).toBe(204)
    const afterAll = await notificationsOf('owner')
    expect(afterAll.every((n) => n.read)).toBe(true)
  })
})

/**
 * Blob 附件往返测试（P1-6 / T2.6，DB 门控）：任意类型（非图片）上传 → 下载字节一致 + mime 正确；
 * 超限 413 语义由路由 bodyLimit 保证（此处验证常规流）。
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

describe.skipIf(!HAS_DB)('Blob 附件（P1-6 / T2.6）', () => {
  let app: ReturnType<typeof createApp>
  let h: Record<string, string>
  let ws = ''

  beforeAll(async () => {
    const db = createDb(process.env.DATABASE_URL!)
    const kv = createKV('')
    app = createApp({ db, kv, sessions: createSessions(kv), appOrigin: 'http://localhost:5173' })
    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `blob-${unique()}@test.dev`, password: 'password123', name: 'Blob' }),
    })
    const auth = (await reg.json()) as { accessToken: string; workspace: { id: string } }
    h = { authorization: `Bearer ${auth.accessToken}` }
    ws = auth.workspace.id
  })

  const upload = async (name: string, mime: string, bytes: Uint8Array): Promise<{ id: string; mime: string }> => {
    const form = new FormData()
    form.append('file', new File([bytes], name, { type: mime }))
    const res = await app.request(`/api/workspaces/${ws}/blobs`, { method: 'POST', headers: h, body: form })
    expect(res.status).toBe(201)
    return (await res.json()) as { id: string; mime: string }
  }

  test('非图片文件上传 → 下载字节一致', async () => {
    // 二进制内容（含 0 字节与高位字节，覆盖 Buffer 编码路径）
    const bytes = new Uint8Array(2048)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + (i % 7) * 11) % 256
    const { id, mime } = await upload('数据集.zip', 'application/zip', bytes)
    expect(mime).toBe('application/zip')

    const res = await app.request(`/api/blobs/${id}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    const received = new Uint8Array(await res.arrayBuffer())
    expect(received.length).toBe(bytes.length)
    expect(Buffer.from(received).equals(Buffer.from(bytes))).toBe(true)
  })

  test('文本文件往返 + 下载名随客户端 download 属性（能力 URL 无鉴权）', async () => {
    const text = new TextEncoder().encode('附件内容示例：设计文档 v1')
    const { id } = await upload('设计文档.md', 'text/markdown', text)
    const res = await app.request(`/api/blobs/${id}`)
    expect(await res.text()).toBe('附件内容示例：设计文档 v1')
  })
})

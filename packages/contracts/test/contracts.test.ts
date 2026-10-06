/** contracts 纯单测：错误码覆盖、schema 校验（无 DB） */
import { describe, expect, test } from 'bun:test'
import {
  ERROR_CODES,
  ERROR_STATUS,
  errorCodeToI18nKey,
  createPageSchema,
  createTagSchema,
  loginSchema,
  registerSchema,
  searchQuerySchema,
} from '../src/index.ts'

describe('错误码（10 §6）', () => {
  test('每个码都有唯一 HTTP 状态映射', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_STATUS[code]).toBeGreaterThan(0)
      expect(errorCodeToI18nKey(code)).toBe(`errors.${code}`)
    }
  })
})

describe('auth schema', () => {
  test('register：合法输入通过，弱密码/坏邮箱拒绝', () => {
    const ok = registerSchema.parse({ email: 'a@b.co', password: '12345678', name: '张三' })
    expect(ok.email).toBe('a@b.co')
    expect(registerSchema.safeParse({ email: 'nope', password: '12345678', name: 'x' }).success).toBe(false)
    expect(registerSchema.safeParse({ email: 'a@b.co', password: 'short', name: 'x' }).success).toBe(false)
    expect(registerSchema.safeParse({ email: 'a@b.co', password: '12345678', name: '' }).success).toBe(false)
  })

  test('login：坏邮箱拒绝', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(false)
  })
})

describe('pages/tags/search schema', () => {
  test('createPage：parentId/templateId 必须 uuid', () => {
    expect(createPageSchema.safeParse({}).success).toBe(true)
    expect(createPageSchema.safeParse({ parentId: 'not-uuid' }).success).toBe(false)
    expect(createPageSchema.safeParse({ templateId: '01800000-0000-7000-8000-000000000000' }).success).toBe(true)
  })

  test('createTag：color 1–8', () => {
    expect(createTagSchema.parse({ name: 'a' }).color).toBe(6)
    expect(createTagSchema.safeParse({ name: 'a', color: 9 }).success).toBe(false)
  })

  test('searchQuery：q 必填', () => {
    expect(searchQuerySchema.safeParse({ q: '关键词' }).success).toBe(true)
    expect(searchQuerySchema.safeParse({}).success).toBe(false)
  })
})

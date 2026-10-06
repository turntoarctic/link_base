/**
 * API 契约（10 §8）：请求/响应的 Zod schema，服务端 parse、前端表单复用同一份。
 * 错误码全集与 HTTP 状态一一对应（10 §6）；前端按 code 本地化（errors 命名空间），
 * i18n key 约定 `errors.<CODE>`，由 scripts/check-i18n.mjs 校验覆盖。
 */
import { z } from 'zod'

/* ---------------------------------- 错误码 ---------------------------------- */

export const ERROR_CODES = [
  'LB_VALIDATION',
  'LB_UNAUTHORIZED',
  'LB_TOKEN_INVALID',
  'LB_FORBIDDEN',
  'LB_NOT_FOUND',
  'LB_PAGE_NOT_FOUND',
  'LB_EMAIL_TAKEN',
  'LB_TAG_EXISTS',
  'LB_RATE_LIMITED',
  'LB_PAYLOAD_TOO_LARGE',
  'LB_INTERNAL',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export const errorCodeSchema = z.enum(ERROR_CODES)

export const errorBodySchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

/** HTTP 状态码映射（10 §6），服务端抛 AppError 用 */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  LB_VALIDATION: 400,
  LB_UNAUTHORIZED: 401,
  LB_TOKEN_INVALID: 401,
  LB_FORBIDDEN: 403,
  LB_NOT_FOUND: 404,
  LB_PAGE_NOT_FOUND: 404,
  LB_EMAIL_TAKEN: 409,
  LB_TAG_EXISTS: 409,
  LB_RATE_LIMITED: 429,
  LB_PAYLOAD_TOO_LARGE: 413,
  LB_INTERNAL: 500,
}

/* ---------------------------------- 通用字段 ---------------------------------- */

export const uuidSchema = z.uuid()
export const localeSchema = z.enum(['zh-CN', 'en'])
export const roleSchema = z.enum(['owner', 'admin', 'member'])

/* ---------------------------------- auth（10 §2） ---------------------------------- */

export const registerSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(8, '至少 8 位').max(128),
  name: z.string().min(1).max(50).trim(),
})
export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
})
export type LoginInput = z.infer<typeof loginSchema>

export const refreshSchema = z.object({
  refreshToken: z.string().min(16).max(256),
})

export const userDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  locale: localeSchema.nullable(),
})

export const workspaceBriefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: roleSchema,
})

export const authSuccessSchema = z.object({
  user: userDtoSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  /** 注册响应专有：自动创建的工作空间与快速开始页（02 §1.1 零仪式） */
  workspace: z
    .object({
      id: z.uuid(),
      name: z.string(),
      role: roleSchema,
      welcomePageId: z.uuid(),
    })
    .optional(),
})
export type AuthSuccess = z.infer<typeof authSuccessSchema>

/* ---------------------------------- users（10 §2.1） ---------------------------------- */

export const patchUserSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  avatarUrl: z.string().max(2048).nullable().optional(),
  locale: localeSchema.optional(),
})
export type PatchUserInput = z.infer<typeof patchUserSchema>

/* ---------------------------------- workspaces（10 §3） ---------------------------------- */

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(80).trim(),
})

export const patchWorkspaceSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  avatarUrl: z.string().max(2048).nullable().optional(),
})

export const inviteSchema = z.object({
  email: z.email().optional(),
})

export const patchMemberSchema = z.object({
  role: roleSchema,
})

export const transferSchema = z.object({
  toUserId: uuidSchema,
})

export const inviteInfoSchema = z.object({
  workspaceName: z.string(),
  inviterName: z.string(),
  expiresAt: z.string(),
})

/* ---------------------------------- pages（10 §4） ---------------------------------- */

export const createPageSchema = z.object({
  title: z.string().max(255).optional(),
  icon: z.string().max(64).optional(),
  /** 建子页：服务端在父页内容追加 subpage 节点（parent_id 为派生缓存，08 §5） */
  parentId: uuidSchema.optional(),
  templateId: uuidSchema.optional(),
})
export type CreatePageInput = z.infer<typeof createPageSchema>

export const patchPageSchema = z.object({
  title: z.string().max(255).optional(),
  icon: z.string().max(64).nullable().optional(),
})
export type PatchPageInput = z.infer<typeof patchPageSchema>

/* ---------------------------------- tags（10 §7） ---------------------------------- */

export const createTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z.number().int().min(1).max(8).default(6),
})
export type CreateTagInput = z.infer<typeof createTagSchema>

export const patchTagSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  color: z.number().int().min(1).max(8).optional(),
})

/* ---------------------------------- search ---------------------------------- */

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
})

/* ---------------------------------- 辅助 ---------------------------------- */

/** 错误码 → errors 命名空间的 i18n key（13 §4） */
export const errorCodeToI18nKey = (code: ErrorCode): string => `errors.${code}`

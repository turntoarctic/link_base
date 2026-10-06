/** AppError（07 §4）：服务层只抛 AppError，路由层不拼错误响应；码与 HTTP 状态一一对应（10 §6） */
import { ERROR_STATUS, type ErrorCode } from '@linkbase/contracts'

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }

  static of(code: ErrorCode, message: string, details?: unknown): AppError {
    return new AppError(code, ERROR_STATUS[code], message, details)
  }
}

export const errValidation = (details?: unknown) =>
  AppError.of('LB_VALIDATION', 'validation failed', details)
export const errUnauthorized = (message = 'unauthorized') => AppError.of('LB_UNAUTHORIZED', message)
export const errTokenInvalid = () => AppError.of('LB_TOKEN_INVALID', 'refresh token invalid or rotated')
export const errForbidden = (message = 'forbidden') => AppError.of('LB_FORBIDDEN', message)
export const errNotFound = (message = 'not found') => AppError.of('LB_NOT_FOUND', message)
export const errPageNotFound = () => AppError.of('LB_PAGE_NOT_FOUND', 'page has no content')
export const errEmailTaken = () => AppError.of('LB_EMAIL_TAKEN', 'email already registered')
export const errTagExists = () => AppError.of('LB_TAG_EXISTS', 'tag name already exists')
export const errRateLimited = (retryAfter: number) =>
  AppError.of('LB_RATE_LIMITED', 'rate limited', { retryAfter })
export const errPayloadTooLarge = (limit: number) =>
  AppError.of('LB_PAYLOAD_TOO_LARGE', `payload exceeds ${limit} bytes`)
export const errInternal = () => AppError.of('LB_INTERNAL', 'internal error')

/** 认证错误（刷新失败等），供表单层区分展示 */
export class AuthError extends Error {
  constructor() {
    super('auth required')
    this.name = 'AuthError'
  }
}

/** 服务端错误响应体（10 §1） */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

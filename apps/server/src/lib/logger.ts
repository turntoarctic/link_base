/** 结构化请求日志（07 §3）：Pino，stdout 直出；敏感字段 redact */
import pino from 'pino'
import { env } from '../env.ts'

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'refreshToken',
      'accessToken',
      '*.password',
      '*.refreshToken',
      '*.accessToken',
    ],
    censor: '[redacted]',
  },
})

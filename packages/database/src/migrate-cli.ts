/** db:migrate CLI（根 package.json scripts.db:migrate） */
import { runMigrations } from './migrate.ts'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL 未设置（参考 .env.example）')
  process.exit(1)
}

const files = await runMigrations(url)
console.log(`migrations ok: ${files.length} applied (${files.join(', ')})`)

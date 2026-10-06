/**
 * 迁移器（07 §2 / 08 §1）：advisory lock 防并发，按文件名顺序应用 drizzle/ 下未执行的 .sql，
 * 记录于 _linkbase_migrations，幂等可重复执行。
 *
 * 直接用 Bun.SQL 执行：迁移文件自含 BEGIN/COMMIT（单文件原子），
 * 且多语句 SQL 需走 simple query 路径（sql.unsafe，无参数）。
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { SQL } from 'bun'

const MIGRATIONS_TABLE = '_linkbase_migrations'
const ADVISORY_LOCK_KEY = 731_002_001 // linkbase 迁移锁的固定 key

/** 从任意文件位置向上找到 packages/database/drizzle（服务端/CLI 通用） */
export async function resolveMigrationDir(from: string = import.meta.dir): Promise<string> {
  let dir = from
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'packages', 'database', 'drizzle')
    if (await Bun.file(join(candidate, '0000_init.sql')).exists()) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`migration dir not found from ${from}`)
}

export async function runMigrations(databaseUrl: string, dir?: string): Promise<string[]> {
  const migrationDir = dir ?? (await resolveMigrationDir())
  const sql = new SQL(databaseUrl)

  try {
    // 防止多实例并发迁移（08 §1）
    await sql`select pg_advisory_lock(${ADVISORY_LOCK_KEY})`
    await sql.unsafe(`create table if not exists ${MIGRATIONS_TABLE} (
      name text primary key,
      applied_at timestamptz not null default now()
    )`)

    const appliedRows = await sql`select name from ${sql.identifier(MIGRATIONS_TABLE)}`
    const applied = new Set(appliedRows.map((r) => String(r.name)))
    const files = (await readdir(migrationDir)).filter((f) => f.endsWith('.sql')).sort()
    const appliedNow: string[] = []

    for (const file of files) {
      if (applied.has(file)) continue
      const content = await readFile(join(migrationDir, file), 'utf8')
      // 文件内含 BEGIN/COMMIT；文件本身幂等（IF NOT EXISTS），崩溃重跑安全
      await sql.unsafe(content)
      await sql`insert into ${sql.identifier(MIGRATIONS_TABLE)} (name) values (${file})`
      appliedNow.push(file)
    }
    return appliedNow
  } finally {
    await sql`select pg_advisory_unlock(${ADVISORY_LOCK_KEY})`
    await sql.end()
  }
}

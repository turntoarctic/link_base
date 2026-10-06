#!/usr/bin/env node
/**
 * i18n 守护（13 §7）：
 * 1) zh-CN 与 en 的每个命名空间 key 集合一致；
 * 2) contracts 的每个 LB_* 错误码在两语言的 errors 命名空间都有文案；
 * 3) apps/web/src 与 packages/editor/src 的 tsx 不含硬编码中文 UI 文案（白名单见下）。
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NS = ['common', 'auth', 'workspace', 'editor', 'errors']

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`✗ ${msg}`)
}

function flatten(obj, prefix = '') {
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') keys.push(...flatten(value, path))
    else keys.push(path)
  }
  return keys
}

async function readLocale(locale, ns) {
  const file = join(root, 'apps/web/src/i18n/locales', locale, `${ns}.json`)
  return JSON.parse(await readFile(file, 'utf8'))
}

// 1) key 对齐
for (const ns of NS) {
  const zh = flatten(await readLocale('zh-CN', ns))
  const en = flatten(await readLocale('en', ns))
  const zhSet = new Set(zh)
  const enSet = new Set(en)
  const onlyZh = zh.filter((k) => !enSet.has(k))
  const onlyEn = en.filter((k) => !zhSet.has(k))
  if (onlyZh.length) fail(`${ns}: en 缺失 key: ${onlyZh.join(', ')}`)
  if (onlyEn.length) fail(`${ns}: zh-CN 缺失 key: ${onlyEn.join(', ')}`)
}

// 2) 错误码覆盖（与 packages/contracts 同源校验）
const contractsSrc = await readFile(join(root, 'packages/contracts/src/index.ts'), 'utf8')
const codes = [...contractsSrc.matchAll(/'(LB_[A-Z_]+)'/g)].map((m) => m[1])
const uniqueCodes = [...new Set(codes)]
for (const locale of ['zh-CN', 'en']) {
  const errors = await readLocale(locale, 'errors')
  for (const code of uniqueCodes) {
    if (!(code in errors)) fail(`${locale}/errors 缺少 ${code} 文案`)
  }
}
console.log(`• 错误码覆盖检查：${uniqueCodes.length} codes`)

// 3) 无硬编码中文文案（JSX 文本/字符串字面量；注释与 i18n 资源除外）
const CJK = /[\u4e00-\u9fff]/
const ALLOWLIST = [
  'linkbase.locale', // 说明注释
  'LanguageSwitcher', // 语言名走 Intl.DisplayNames
]

async function* walkTs(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'locales' || entry.name === 'node_modules') continue
      yield* walkTs(full)
    } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      // *.test.tsx 排除：测试的描述与断言文案不是 UI 文案（本就应为被翻译文案本身）
      yield full
    }
  }
}

const scannedDirs = [join(root, 'apps/web/src'), join(root, 'packages/editor/src')]
let fileCount = 0
for (const dir of scannedDirs) {
  for await (const file of walkTs(dir)) {
    fileCount += 1
    const lines = (await readFile(file, 'utf8')).split('\n')
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
      // 只检查字符串字面量与 JSX 文本中的中文
      const withoutComments = line.split('//')[0]
      const stringLiterals = [...withoutComments.matchAll(/>([^<>{}]*[\u4e00-\u9fff][^<>{}]*)<|'([^']*[\u4e00-\u9fff][^']*)'|`([^`]*[\u4e00-\u9fff][^`]*)`/g)]
      for (const match of stringLiterals) {
        const text = match[1] ?? match[2] ?? match[3] ?? ''
        if (ALLOWLIST.some((allowed) => text.includes(allowed))) continue
        // i18n t() 调用的 key 允许中文（如 t('标签')）
        const before = withoutComments.slice(0, match.index ?? 0)
        if (/t\(\s*[`']?$/.test(before)) continue
        fail(`硬编码中文 ${file.replace(root, '')}:${i + 1} → ${text.slice(0, 30)}`)
      }
    })
  }
}
console.log(`• 硬编码扫描：${fileCount} 个 tsx 文件`)

if (failed) process.exit(1)
console.log('✓ check-i18n 全绿')

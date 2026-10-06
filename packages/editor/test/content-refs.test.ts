/**
 * 静态校验（无 DOM 也能跑）：编辑器全部节点/扩展注册名与 content 表达式引用互洽。
 * 背景：content 表达式是运行时 schema 字符串，typecheck 不设防——'summary block+' 引用
 * 不存在的节点名曾在浏览器 schema 构建时整站崩（编辑器全不可用）。
 * 节点名两种形态都认：字符串字面量 / NODE_* 常量（值表来自 schema.ts）。
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

const dir = join(dirname(import.meta.path), '../src')

/** 内置 group（starter-kit/tiptap 提供） */
const GROUPS = new Set(['block', 'inline', 'text'])

function loadNodeNames(): Set<string> {
  const names = new Set<string>()
  const schemaSrc = readFileSync(join(dir, 'schema.ts'), 'utf8')
  for (const m of schemaSrc.matchAll(/export const (NODE_[A-Z_]+) = '([a-zA-Z]+)'/g)) {
    names.add(m[2]!)
  }
  const files = [
    'callout.ts',
    'details.ts',
    'math-block.ts',
    'mermaid-block.ts',
    'base.ts',
    'subpage-list.ts',
    'attachment.ts',
    'image.ts',
    'mention.ts',
    'subpage.ts',
  ]
  for (const file of files) {
    const src = readFileSync(join(dir, 'extensions', file), 'utf8')
    for (const m of src.matchAll(/\.create(?:<[^>]+>)?\(\{\s*name:\s*'([a-zA-Z]+)'/g)) {
      names.add(m[1]!)
    }
  }
  return names
}

function loadExpressions(): Array<{ file: string; expr: string }> {
  const expressions: Array<{ file: string; expr: string }> = []
  const files = [
    'callout.ts',
    'details.ts',
    'math-block.ts',
    'mermaid-block.ts',
    'base.ts',
    'subpage-list.ts',
    'attachment.ts',
    'image.ts',
    'mention.ts',
    'subpage.ts',
    'slash-items.ts',
  ]
  for (const file of files) {
    const src = readFileSync(join(dir, 'extensions', file), 'utf8')
    for (const m of src.matchAll(/content:\s*'([^']+)'/g)) {
      expressions.push({ file, expr: m[1] })
    }
  }
  const kit = readFileSync(join(dir, 'index.ts'), 'utf8')
  for (const m of kit.matchAll(/content:\s*'([^']+)'/g)) {
    expressions.push({ file: 'index.ts', expr: m[1] })
  }
  return expressions
}

test('content 表达式引用的节点名/组均有注册（运行时崩溃的静态防线）', () => {
  const nodeNames = loadNodeNames()
  const expressions = loadExpressions()

  // 规模护栏：注册节点 11+（防正则失配静默通过）
  expect(nodeNames.size).toBeGreaterThan(10)
  expect(expressions.length).toBeGreaterThan(3)

  for (const { file, expr } of expressions) {
    for (const token of expr.split(/\s+/)) {
      const name = token.replace(/[*+?]/g, '').replace(/[()]/g, '')
      if (!name) continue
      if (GROUPS.has(name) || nodeNames.has(name)) continue
      throw new Error(`${file}: content '${expr}' 引用了未注册的节点 '${name}'`)
    }
  }
})

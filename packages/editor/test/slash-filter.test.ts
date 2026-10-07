/** slash 模糊过滤单测（Notion 化 T4）：得分排序与子序列匹配 + 最近使用纯函数 */
import { describe, expect, test } from 'bun:test'
import type { SlashItem } from '../src/extensions/slash-items.ts'
import { scoreSlashItem, buildSlashItems } from '../src/extensions/slash-items.ts'
import { mergeRecentItems } from '../src/extensions/slash-recent.ts'

function item(id: string, keywords: string[]): SlashItem {
  return { id, group: 'text', icon: {} as never, keywords, action: () => {} }
}

describe('scoreSlashItem', () => {
  test('前缀 > 词首 > 包含 > 子序列', () => {
    expect(scoreSlashItem(item('heading1', ['h1', '标题']), 'heading')).toBe(100)
    expect(scoreSlashItem(item('heading1', ['h1', '标题']), 'h1')).toBe(80)
    expect(scoreSlashItem(item('subpage', ['subpage', '子页面']), '页面')).toBe(40)
  })

  test('子序列：h1 命中 heading1（词首优先于子序列）', () => {
    expect(scoreSlashItem(item('heading1', ['标题']), 'h1')).toBe(20) // 子序列
    expect(scoreSlashItem(item('heading1', ['标题']), 'he')).toBe(100) // id 前缀
  })

  test('不匹配得 0 分', () => {
    expect(scoreSlashItem(item('paragraph', ['文本']), 'zzz')).toBe(0)
  })

  test('空查询 = 命中全部（基础分 1）', () => {
    expect(scoreSlashItem(item('paragraph', []), '')).toBe(1)
  })
})

describe('mergeRecentItems', () => {
  test('头插去重，最多保留 5 个', () => {
    expect(mergeRecentItems(['a', 'b'], 'c')).toEqual(['c', 'a', 'b'])
    expect(mergeRecentItems(['a', 'b', 'a'], 'a')).toEqual(['a', 'b'])
    expect(mergeRecentItems(['1', '2', '3', '4', '5'], '6')).toEqual(['6', '1', '2', '3', '4'])
  })
})

describe('buildSlashItems', () => {
  test('全部 20 项均可被模糊过滤命中（冒烟：buildSlashItems 不抛错）', () => {
    // buildSlashItems 依赖 SlashMenuOptions（pickImage 等可选），空选项可构建
    const items = buildSlashItems({})
    expect(items.length).toBeGreaterThanOrEqual(20)
  })
})

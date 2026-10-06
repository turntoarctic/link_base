/** Base 视图纯函数单测（T2.8 P2）：筛选/排序/数值与布尔列比较 */
import { describe, expect, test } from 'bun:test'
import { applyFilterSort, type RowSnapshot } from '../src/base-view-data.ts'
import type { BaseColumn } from '../src/extensions/base.ts'

const columns: BaseColumn[] = [
  { id: 'title', name: '标题', type: 'text' },
  { id: 'num', name: '点数', type: 'number' },
  { id: 'done', name: '完成', type: 'checkbox' },
  { id: 'tag', name: '标签', type: 'select', options: [{ id: 'o1', name: '高' }, { id: 'o2', name: '低' }] },
]

function row(id: string, title: string, cells: Record<string, unknown>): RowSnapshot {
  return { id, title, pageId: null, cells }
}

const rows = [
  row('1', '任务甲', { num: 30, done: false, tag: 'o2' }),
  row('2', '任务乙', { num: 10, done: true, tag: 'o1' }),
  row('3', '任务丙', { num: 20, done: false }),
]

describe('applyFilterSort', () => {
  test('筛选：标题与单元格文本包含匹配', () => {
    expect(applyFilterSort(rows, columns, { filter: '任务乙', sortBy: null, sortDir: 'asc' }).map((r) => r.id)).toEqual(['2'])
    expect(applyFilterSort(rows, columns, { filter: '20', sortBy: null, sortDir: 'asc' }).map((r) => r.id)).toEqual(['3'])
    expect(applyFilterSort(rows, columns, { filter: '  ', sortBy: null, sortDir: 'asc' }).length).toBe(3)
  })

  test('数值列排序（asc/desc）', () => {
    const opts = { filter: '', sortBy: 'num', sortDir: 'asc' as const }
    expect(applyFilterSort(rows, columns, opts).map((r) => r.id)).toEqual(['2', '3', '1'])
    expect(applyFilterSort(rows, columns, { ...opts, sortDir: 'desc' }).map((r) => r.id)).toEqual(['1', '3', '2'])
  })

  test('布尔列排序（false 在前 asc）', () => {
    const out = applyFilterSort(rows, columns, { filter: '', sortBy: 'done', sortDir: 'asc' }).map((r) => r.id)
    // 行 1/3 done=false，行 2 done=true
    expect(out.filter((id) => id !== '2')).toEqual(['1', '3'])
    expect(out.at(-1)).toBe('2')
  })

  test('标题排序按 zh 字典序（拼音序：丙 < 甲 < 乙）', () => {
    const out = applyFilterSort(rows, columns, { filter: '', sortBy: 'title', sortDir: 'asc' }).map((r) => r.title)
    expect(out).toEqual(['任务丙', '任务甲', '任务乙'])
  })
})

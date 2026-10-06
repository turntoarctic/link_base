/**
 * Base 视图（P1-8 / T2.8）：表格（可编辑单元格/加行删行/加列）+ 看板（按选择列分组/换组）。
 * 数据经 base:{id} Y.Map 直写，实时协作与持久化由 Yjs 通路承接。
 */
import { useCallback, useEffect, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { FileText, LayoutGrid, Plus, Table2, Trash2, X } from 'lucide-react'
import * as Y from 'yjs'
import { getBaseBridge, type BaseColumn } from '../extensions/base.ts'

const cn = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ')

type RowMap = Y.Map<any>

interface ColumnData extends BaseColumn {}

function readColumns(map: any): ColumnData[] {
  const arr = map.get('columns') as Y.Array<Y.Map<unknown>> | undefined
  if (!arr) return []
  return arr.toArray().map((c: any) => ({
    id: String(c.get('id')),
    name: String(c.get('name')),
    type: c.get('type') as ColumnData['type'],
    options: c.get('options') as ColumnData['options'] | undefined,
  }))
}

function readRows(map: any): Array<{ id: string; row: RowMap }> {
  const rows = map.get('rows') as Y.Map<unknown> | undefined
  if (!rows) return []
  const out: Array<{ id: string; row: RowMap }> = []
  rows.forEach((row, id) => out.push({ id, row: row as RowMap }))
  return out
}

function rowTitle(row: RowMap): string {
  return String(row.get('title') ?? '')
}

function cellValue(row: RowMap, colId: string): unknown {
  const cells = (row.get('cells') ?? {}) as Record<string, unknown>
  return cells[colId]
}

function setCellValue(row: RowMap, colId: string, value: unknown): void {
  const cells = { ...((row.get('cells') ?? {}) as Record<string, unknown>), [colId]: value }
  row.set('cells', cells)
}

/** value → 视图文本 */
function display(value: unknown, col: ColumnData): string {
  if (value == null || value === '') return ''
  if (col.type === 'checkbox') return value ? '✓' : ''
  if (col.type === 'select') {
    const opt = col.options?.find((o) => o.id === value)
    return opt?.name ?? String(value)
  }
  return String(value)
}

export function BaseView({ node }: NodeViewProps) {
  const { t } = useTranslation('editor')
  const baseId = String((node.attrs as { baseId?: string }).baseId ?? '')
  const bridge = getBaseBridge()
  const ydoc = bridge?.ydoc

  const [, force] = useReducerState()
  const [view, setView] = useState<'table' | 'board'>('table')
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColType, setNewColType] = useState<ColumnData['type']>('text')

  const map = ydoc ? (ydoc.getMap(`base:${baseId}`) as any) : null
  const refresh = useCallback(() => force(), [force])

  useEffect(() => {
    if (!map) return
    map.observeDeep(refresh)
    return () => {
      map.unobserveDeep(refresh)
    }
  }, [map, refresh])

  if (!ydoc || !map) {
    return (
      <NodeViewWrapper data-type="baseBlock" className="linkbase-base">
        <div className="linkbase-base-empty">{t('base.loadFailed')}</div>
      </NodeViewWrapper>
    )
  }

  const columns = readColumns(map)
  const rows = readRows(map)
  const rowsMap = map.get('rows') as any
  const selectColumn = columns.find((c) => c.type === 'select')

  const addRow = () => {
    const row = new Y.Map() as RowMap
    row.set('title', '')
    row.set('cells', {})
    rowsMap.set(crypto.randomUUID(), row)
  }

  const deleteRow = (id: string) => {
    rowsMap.delete(id)
  }

  const addColumn = () => {
    if (!newColName.trim()) return
    const arr = map.get('columns') as Y.Array<unknown>
    const col: ColumnData = {
      id: crypto.randomUUID(),
      name: newColName.trim(),
      type: newColType,
      ...(newColType === 'select'
        ? { options: [1, 2].map((n) => ({ id: crypto.randomUUID(), name: t('base.optionN', { n }) })) }
        : {}),
    }
    arr.push([col])
    setAddingColumn(false)
    setNewColName('')
  }

  const deleteColumn = (colId: string) => {
    const arr = map.get('columns') as Y.Array<Y.Map<unknown>>
    const index = arr.toArray().findIndex((c: any) => String(c.get('id')) === colId)
    if (index > 0) arr.delete(index, 1) // 首列 title 不可删
  }

  const promote = async (row: RowMap) => {
    if (!bridge) return
    const created = await bridge.source.createSubpage(rowTitle(row))
    if (created) row.set('pageId', created.pageId)
  }

  // 看板分组
  const groups: Array<{ key: string; label: string; rows: Array<{ id: string; row: RowMap }> }> = []
  if (view === 'board' && selectColumn) {
    for (const opt of selectColumn.options ?? []) {
      groups.push({ key: opt.id, label: opt.name, rows: rows.filter((r) => cellValue(r.row, selectColumn.id) === opt.id) })
    }
    groups.push({ key: '__none', label: t('base.noGroup'), rows: rows.filter((r) => !cellValue(r.row, selectColumn.id)) })
  }

  const renderCell = (row: RowMap, col: ColumnData) => {
    const value = cellValue(row, col.id)
    if (col.id === 'title' || col.type === 'text') {
      return (
        col.id === 'title' ? (
          row.get('pageId') ? (
            <button
              type="button"
              className="linkbase-base-cell-title link"
              contentEditable={false}
              onClick={() => bridge?.source.onOpen(String(row.get('pageId')))}
            >
              {rowTitle(row) || t('base.untitled')}
            </button>
          ) : (
            <input
              className="linkbase-base-cell-input"
              value={rowTitle(row)}
              placeholder={t('base.untitled')}
              onChange={(e) => row.set('title', e.target.value)}
            />
          )
        ) : (
          <input
            className="linkbase-base-cell-input"
            value={String(value ?? '')}
            onChange={(e) => setCellValue(row, col.id, e.target.value)}
          />
        )
      )
    }
    if (col.type === 'select') {
      return (
        <select
          className="linkbase-base-cell-input"
          value={String(value ?? '')}
          onChange={(e) => setCellValue(row, col.id, e.target.value || null)}
        >
          <option value=""></option>
          {(col.options ?? []).map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )
    }
    if (col.type === 'date') {
      return (
        <input
          type="date"
          className="linkbase-base-cell-input"
          value={String(value ?? '')}
          onChange={(e) => setCellValue(row, col.id, e.target.value || null)}
        />
      )
    }
    if (col.type === 'number') {
      return (
        <input
          type="number"
          className="linkbase-base-cell-input"
          value={value == null ? '' : String(value)}
          onChange={(e) => setCellValue(row, col.id, e.target.value === '' ? null : Number(e.target.value))}
        />
      )
    }
    if (col.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => setCellValue(row, col.id, e.target.checked)}
        />
      )
    }
    return null
  }

  return (
    <NodeViewWrapper data-type="baseBlock" className="linkbase-base">
      <div className="linkbase-base-toolbar" contentEditable={false}>
        <div className="linkbase-base-views">
          <button type="button" className={cn(view === 'table' && 'is-active')} onClick={() => setView('table')}>
            <Table2 size={13} /> {t('base.viewTable')}
          </button>
          <button
            type="button"
            className={cn(view === 'board' && 'is-active')}
            disabled={!selectColumn}
            title={selectColumn ? undefined : t('base.needSelectColumn')}
            onClick={() => setView('board')}
          >
            <LayoutGrid size={13} /> {t('base.viewBoard')}
          </button>
        </div>
        {view === 'table' ? (
          <button type="button" className="linkbase-base-add" onClick={addRow}>
            <Plus size={13} /> {t('base.addRow')}
          </button>
        ) : (
          <span className="linkbase-base-groupby">{t('base.groupBy', { column: selectColumn?.name ?? '' })}</span>
        )}
      </div>

      {view === 'table' && (
        <table className="linkbase-base-table" contentEditable={false}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id}>
                  <span className="linkbase-base-colname">
                    {col.name}
                    {col.id !== 'title' && (
                      <button type="button" aria-label={t('base.deleteColumn')} onClick={() => deleteColumn(col.id)}>
                        <X size={11} />
                      </button>
                    )}
                  </span>
                  <span className="linkbase-base-coltype">{t(`base.type.${col.type}`)}</span>
                </th>
              ))}
              <th className="linkbase-base-addcol-th">
                {addingColumn ? (
                  <div className="linkbase-base-addcol">
                    <input
                      autoFocus
                      value={newColName}
                      placeholder={t('base.columnName')}
                      onChange={(e) => setNewColName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addColumn()}
                    />
                    <select value={newColType} onChange={(e) => setNewColType(e.target.value as ColumnData['type'])}>
                      <option value="text">{t('base.type.text')}</option>
                      <option value="select">{t('base.type.select')}</option>
                      <option value="date">{t('base.type.date')}</option>
                      <option value="number">{t('base.type.number')}</option>
                      <option value="checkbox">{t('base.type.checkbox')}</option>
                    </select>
                    <button type="button" onClick={addColumn} aria-label={t('base.addColumn')}>
                      <Plus size={12} />
                    </button>
                    <button type="button" onClick={() => setAddingColumn(false)} aria-label={t('common:cancel')}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button type="button" className="linkbase-base-addcol-btn" onClick={() => setAddingColumn(true)}>
                    <Plus size={12} />
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, row }) => (
              <tr key={id}>
                {columns.map((col) => (
                  <td key={col.id}>{renderCell(row, col)}</td>
                ))}
                <td className="linkbase-base-rowactions">
                  {!row.get('pageId') && (
                    <button
                      type="button"
                      title={t('base.promote')}
                      onClick={() => void promote(row)}
                    >
                      <FileText size={12} />
                    </button>
                  )}
                  {row.get('pageId') && (
                    <button
                      type="button"
                      title={t('base.openSubpage')}
                      onClick={() => bridge?.source.onOpen(String(row.get('pageId')))}
                    >
                      <FileText size={12} className="text-(--primary)" />
                    </button>
                  )}
                  <button type="button" title={t('base.deleteRow')} onClick={() => deleteRow(id)}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view === 'board' && (
        <div className="linkbase-base-board" contentEditable={false}>
          {groups.map((group) => (
            <div key={group.key} className="linkbase-base-board-col">
              <div className="linkbase-base-board-colhead">
                {group.label}
                <span className="linkbase-base-board-count">{group.rows.length}</span>
              </div>
              {group.rows.map(({ id, row }) => (
                <div key={id} className="linkbase-base-card">
                  <div className="linkbase-base-card-title">{rowTitle(row) || t('base.untitled')}</div>
                  {row.get('pageId') ? (
                    <button type="button" className="linkbase-base-card-action" onClick={() => bridge?.source.onOpen(String(row.get('pageId')))}>
                      <FileText size={11} /> {t('base.openSubpage')}
                    </button>
                  ) : (
                    <button type="button" className="linkbase-base-card-action" onClick={() => void promote(row)}>
                      <FileText size={11} /> {t('base.promote')}
                    </button>
                  )}
                  {selectColumn && (
                    <select
                      className="linkbase-base-card-select"
                      value={String(cellValue(row, selectColumn.id) ?? '')}
                      onChange={(e) => setCellValue(row, selectColumn.id, e.target.value || null)}
                    >
                      <option value="">{t('base.noGroup')}</option>
                      {(selectColumn.options ?? []).map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
              <button type="button" className="linkbase-base-board-add" onClick={addRow}>
                <Plus size={12} /> {t('base.addRow')}
              </button>
            </div>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  )
}

function useReducerState(): [unknown, () => void] {
  const [, setTick] = useState(0)
  return [0, () => setTick((v) => v + 1)]
}

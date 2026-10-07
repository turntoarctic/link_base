/** slash 菜单弹层（shadcn 风格分组列表），文案走 i18next editor 命名空间（13 §5） */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SlashItem } from '../extensions/slash-items.ts'
import { readRecentSlashItems, recordRecentSlashItem } from '../extensions/slash-recent.ts'
import { registerListKeyboardNav, type SuggestionPopupProps } from './suggestion.tsx'

const GROUPS: Array<SlashItem['group']> = ['text', 'media', 'advanced']

export function SlashPopup({ props, registerKeyDown }: SuggestionPopupProps<SlashItem>) {
  const { t } = useTranslation('editor')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const items = props.items
  // 首帧 items = 未过滤全量；之后逐字符过滤。全量态即「空查询」态（显示最近使用）
  const [initialCount] = useState(() => props.items.length)
  const queryEmpty = items.length === initialCount

  // 显示序扁平列表：分组渲染顺序（text→media→advanced）≠ items 数组顺序，
  // 键盘/点击必须按显示序取项（历史上 items[active] 直接索引数组导致项错位）
  const flat = useMemo(() => {
    if (queryEmpty) {
      // 空查询：最近使用（存在且在 items 中）置顶，其余按分组
      const recentIds = new Set(readRecentSlashItems())
      const recent = items.filter((i) => recentIds.has(i.id))
      const rest = GROUPS.map((group) => items.filter((i) => i.group === group && !recentIds.has(i.id))).flat()
      return [...recent, ...rest]
    }
    return GROUPS.map((group) => items.filter((i) => i.group === group)).flat()
  }, [items, queryEmpty])

  useEffect(() => {
    setActive(0)
  }, [flat])

  registerListKeyboardNav(registerKeyDown, {
    count: () => flat.length,
    getActive: () => active,
    setActive,
    onPick: (index) => {
      const item = flat[index]
      if (item) {
        recordRecentSlashItem(item.id)
        props.command(item)
      }
    },
  })

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const grouped = useMemo(() => {
    if (queryEmpty) {
      const recentIds = new Set(readRecentSlashItems())
      const recent = items.filter((i) => recentIds.has(i.id))
      const groups = GROUPS.map((group) => ({ group, items: items.filter((i) => i.group === group && !recentIds.has(i.id)) })).filter(
        (g) => g.items.length > 0,
      )
      return recent.length > 0 ? [{ group: 'recent' as const, items: recent }, ...groups] : groups
    }
    return GROUPS.map((group) => ({ group, items: items.filter((i) => i.group === group) })).filter(
      (g) => g.items.length > 0,
    )
  }, [items, queryEmpty])

  return (
    <div className="linkbase-menu" role="listbox" aria-label={t('slash.title')}>
      <div className="linkbase-menu-list" ref={listRef}>
        {flat.length === 0 && <div className="linkbase-menu-empty">{t('slash.noResults')}</div>}
        {grouped.map(({ group, items: groupItems }) => (
          <div key={group}>
            <div className="linkbase-menu-group-title">{t(`slash.group.${group}`)}</div>
            {groupItems.map((item) => {
              const index = flat.indexOf(item)
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className="linkbase-menu-item"
                  data-active={index === active}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    recordRecentSlashItem(item.id)
                    props.command(item)
                  }}
                >
                  <span className="linkbase-menu-item-icon">
                    <Icon size={16} />
                  </span>
                  <span>{t(`slash.item.${item.id}`)}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

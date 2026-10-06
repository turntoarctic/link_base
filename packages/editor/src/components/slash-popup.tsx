/** slash 菜单弹层（shadcn 风格分组列表），文案走 i18next editor 命名空间（13 §5） */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SlashItem } from '../extensions/slash-items.ts'
import { registerListKeyboardNav, type SuggestionPopupProps } from './suggestion.tsx'

const GROUPS: Array<SlashItem['group']> = ['text', 'media', 'advanced']

export function SlashPopup({ props, registerKeyDown }: SuggestionPopupProps<SlashItem>) {
  const { t } = useTranslation('editor')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const items = props.items

  useEffect(() => {
    setActive(0)
  }, [items])

  registerListKeyboardNav(registerKeyDown, {
    count: () => items.length,
    getActive: () => active,
    setActive,
    onPick: (index) => {
      const item = items[index]
      if (item) props.command(item)
    },
  })

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({ group, items: items.filter((i) => i.group === group) })).filter(
        (g) => g.items.length > 0,
      ),
    [items],
  )

  let flatIndex = -1

  return (
    <div className="linkbase-menu" role="listbox" aria-label={t('slash.title')}>
      <div className="linkbase-menu-list" ref={listRef}>
        {grouped.length === 0 && <div className="linkbase-menu-empty">{t('slash.noResults')}</div>}
        {grouped.map(({ group, items: groupItems }) => (
          <div key={group}>
            <div className="linkbase-menu-group-title">{t(`slash.group.${group}`)}</div>
            {groupItems.map((item) => {
              flatIndex += 1
              const index = flatIndex
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

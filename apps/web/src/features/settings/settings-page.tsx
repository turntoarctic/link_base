/** 设置页（06 §2：Tab 子路由简化为区块）：通用（名称/语言/主题）、成员（邀请/角色/转让）、标签 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { authApi, tagApi, workspaceApi } from '@/lib/api'
import { changeLocale, type AppLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Modal } from '@/components/ui/modal'

type Tab = 'general' | 'members' | 'tags'

export default function SettingsPage() {
  const { workspaceId = '' } = useParams()
  const { t } = useTranslation(['workspace', 'common'])
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab | null) ?? 'general'

  const ws = useQuery({ queryKey: ['ws', workspaceId], queryFn: () => workspaceApi.get(workspaceId) })
  const me = useQuery({ queryKey: ['me'], queryFn: authApi.me, staleTime: 60_000 })
  const role = me.data?.workspaces.find((w) => w.id === workspaceId)?.role ?? 'member'

  return (
    <div className="mx-auto max-w-(--width-content) px-6 py-8">
      <h1 className="mb-6 text-[22px] font-semibold">{t('settings.title')}</h1>

      <div className="mb-6 flex gap-1 text-[13px]">
        {(['general', 'members', 'tags'] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={
              'rounded-md px-3 py-1.5 ' +
              (tab === key ? 'bg-(--accent) font-medium' : 'text-(--muted-foreground) hover:bg-(--muted)')
            }
            onClick={() => setParams({ tab: key })}
          >
            {t(`settings.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralTab workspaceId={workspaceId} name={ws.data?.name ?? ''} />}
      {tab === 'members' && <MembersTab workspaceId={workspaceId} role={role} />}
      {tab === 'tags' && <TagsTab workspaceId={workspaceId} />}
    </div>
  )
}

function GeneralTab({ workspaceId, name }: { workspaceId: string; name: string }) {
  const { t } = useTranslation(['workspace', 'common'])
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const [value, setValue] = useState(name)

  useEffect(() => setValue(name), [name])

  const save = useMutation({
    mutationFn: () => workspaceApi.patch(workspaceId, { name: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ws', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  return (
    <section className="flex flex-col gap-6 text-[14px]">
      <div>
        <div className="mb-1.5 font-medium">{t('settings.workspaceName')}</div>
        <div className="flex max-w-[360px] gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} />
          <Button variant="secondary" disabled={save.isPending || value === name} onClick={() => save.mutate()}>
            {t('settings.saveName')}
          </Button>
        </div>
      </div>
      <div>
        <div className="mb-1.5 font-medium">{t('settings.language')}</div>
        <LanguageSwitcher
          onChange={(locale: AppLocale) => {
            void changeLocale(locale)
            void authApi.patchMe({ locale }).catch(() => {})
            void user
          }}
        />
      </div>
      <div>
        <div className="mb-1.5 font-medium">{t('settings.theme')}</div>
        <Select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}>
          <option value="light">{t('common:themeLight')}</option>
          <option value="dark">{t('common:themeDark')}</option>
          <option value="system">{t('common:themeSystem')}</option>
        </Select>
      </div>
    </section>
  )
}

function MembersTab({ workspaceId, role }: { workspaceId: string; role: 'owner' | 'admin' | 'member' }) {
  const { t } = useTranslation(['workspace', 'common'])
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const members = useQuery({ queryKey: ['members', workspaceId], queryFn: () => workspaceApi.members(workspaceId) })
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [transferId, setTransferId] = useState<string | null>(null)

  const canManage = role === 'owner' || role === 'admin'

  const invite = useMutation({
    mutationFn: () => workspaceApi.invite(workspaceId),
    onSuccess: (result) => setInviteUrl(result.inviteUrl),
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['members', workspaceId] })
  }

  const transferTarget = (members.data ?? []).find((m) => m.userId === transferId)

  return (
    <section className="flex flex-col gap-6 text-[14px]">
      {canManage && (
        <div>
          <div className="mb-1.5 font-medium">{t('settings.invite')}</div>
          <div className="mb-2 text-[13px] text-(--muted-foreground)">{t('settings.inviteHint')}</div>
          <div className="flex max-w-[520px] flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => invite.mutate()}>
              {t('settings.createInvite')}
            </Button>
            {inviteUrl && (
              <>
                <code className="max-w-[340px] truncate rounded bg-(--secondary) px-2 py-1 text-[12px]">
                  {inviteUrl}
                </code>
                <Button
                  variant="link"
                  onClick={() => void navigator.clipboard.writeText(inviteUrl).catch(() => {})}
                >
                  {t('settings.copyInvite')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 font-medium">{t('settings.members')}</div>
        <div className="flex flex-col divide-y divide-(--border)">
          {(members.data ?? []).map((member) => (
            <div key={member.userId} className="flex items-center gap-3 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--primary) text-[11px] text-white">
                {member.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate">{member.name}</div>
                <div className="truncate text-[12px] text-(--muted-foreground)">{member.email}</div>
              </div>
              <span className="text-[12px] text-(--muted-foreground)">
                {t(`settings.role${member.role[0]!.toUpperCase()}${member.role.slice(1)}`)}
              </span>
              {canManage && member.role !== 'owner' && member.userId !== user?.id && (
                <>
                  <Select
                    className="h-7 text-[12px]"
                    value={member.role}
                    onChange={(e) => {
                      void workspaceApi
                        .setRole(workspaceId, member.userId, e.target.value)
                        .then(refresh)
                        .catch(() => {})
                    }}
                  >
                    <option value="admin">{t('settings.roleAdmin')}</option>
                    <option value="member">{t('settings.roleMember')}</option>
                  </Select>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-(--destructive)"
                    onClick={() => {
                      void workspaceApi.removeMember(workspaceId, member.userId).then(refresh)
                    }}
                  >
                    {t('settings.removeMember')}
                  </Button>
                </>
              )}
              {role === 'owner' && member.role !== 'owner' && member.userId !== user?.id && (
                <Button variant="link" size="sm" onClick={() => setTransferId(member.userId)}>
                  {t('settings.transferOwner')}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={transferId !== null}
        onClose={() => setTransferId(null)}
        title={t('settings.transferConfirm', { name: transferTarget?.name ?? '' })}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setTransferId(null)}>
            {t('common:cancel')}
          </Button>
          <Button
            disabled={!transferId}
            onClick={() => {
              if (!transferId) return
              void workspaceApi.transfer(workspaceId, transferId).then(() => {
                setTransferId(null)
                refresh()
                void queryClient.invalidateQueries({ queryKey: ['me'] })
              })
            }}
          >
            {t('common:confirm')}
          </Button>
        </div>
      </Modal>
    </section>
  )
}

function TagsTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['workspace', 'common'])
  const queryClient = useQueryClient()
  const tags = useQuery({ queryKey: ['tags', workspaceId], queryFn: () => tagApi.list(workspaceId) })
  const [name, setName] = useState('')
  const [color, setColor] = useState(6)

  const create = useMutation({
    mutationFn: () => tagApi.create(workspaceId, { name, color }),
    onSuccess: () => {
      setName('')
      void queryClient.invalidateQueries({ queryKey: ['tags', workspaceId] })
    },
  })

  return (
    <section className="flex flex-col gap-4 text-[14px]">
      <div className="flex max-w-[420px] items-center gap-2">
        <Input value={name} placeholder={t('tags.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`${t('tags.color')} ${c}`}
              className={
                'h-5 w-5 rounded-full border ' + (color === c ? 'border-(--foreground)' : 'border-transparent')
              }
              style={{ background: `var(--tag-${c}-bg)` }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <Button variant="secondary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
          {t('tags.create')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(tags.data ?? []).map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px]"
            style={{ background: `var(--tag-${tag.color}-bg)`, color: `var(--tag-${tag.color}-fg)` }}
          >
            {tag.name}
            <button
              type="button"
              aria-label={t('common:delete')}
              onClick={() => {
                void tagRemove(workspaceId, tag.id).then(() =>
                  queryClient.invalidateQueries({ queryKey: ['tags', workspaceId] }),
                )
              }}
              className="opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        {tags.data?.length === 0 && (
          <span className="text-[13px] text-(--muted-foreground)">{t('tags.empty')}</span>
        )}
      </div>
    </section>
  )
}

/** 设置页（06 §2）：通用（名称/语言/主题）、成员（邀请/角色/转让）、标签 —— Card 分区 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link2, Settings as SettingsIcon, Tag, UsersRound, X } from 'lucide-react'
import { authApi, tagApi, workspaceApi } from '@/lib/api'
import { changeLocale, type AppLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar } from '@/components/ui/primitives'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { LanguageSwitcher } from '@/components/language-switcher'
import { toast } from '@/components/ui/sonner'
import { cn } from '@/lib/cn'

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
    <div className="mx-auto max-w-(--width-content) px-8 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-(--muted) text-(--muted-foreground)">
          <SettingsIcon size={15} />
        </span>
        <h1 className="text-[22px] font-bold tracking-tight">{t('settings.title')}</h1>
      </div>

      <div className="mb-5 flex gap-1 text-[13px]">
        {(['general', 'members', 'tags'] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 transition-colors',
              tab === key
                ? 'bg-(--accent) font-medium text-(--accent-foreground)'
                : 'text-(--muted-foreground) hover:bg-(--muted)',
            )}
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
      toast.success(t('workspace:toast.nameSaved'))
    },
    onError: () => toast.error(t('common:operationFailed')),
  })

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.workspaceName')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-[400px] gap-2">
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
            <Button
              variant="secondary"
              disabled={save.isPending || value === name}
              onClick={() => save.mutate()}
            >
              {t('settings.saveName')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageSwitcher
            onChange={(locale: AppLocale) => {
              void changeLocale(locale)
              void authApi.patchMe({ locale }).catch(() => {})
              void user
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.theme')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            className="w-[160px]"
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
          >
            <option value="light">{t('common:themeLight')}</option>
            <option value="dark">{t('common:themeDark')}</option>
            <option value="system">{t('common:themeSystem')}</option>
          </Select>
        </CardContent>
      </Card>
    </div>
  )
}

function MembersTab({ workspaceId, role }: { workspaceId: string; role: 'owner' | 'admin' | 'member' }) {
  const { t } = useTranslation(['workspace', 'common'])
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const members = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () => workspaceApi.members(workspaceId),
  })
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

  const copyInvite = () => {
    if (!inviteUrl) return
    void navigator.clipboard
      .writeText(inviteUrl)
      .then(() => toast.success(t('workspace:toast.inviteCopied')))
      .catch(() => {})
  }

  const transferTarget = (members.data ?? []).find((m) => m.userId === transferId)

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.invite')}</CardTitle>
            <p className="text-[13px] text-(--muted-foreground)">{t('settings.inviteHint')}</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" disabled={invite.isPending} onClick={() => invite.mutate()}>
                <UsersRound size={13} />
                {t('settings.createInvite')}
              </Button>
              {inviteUrl && (
                <>
                  <code className="max-w-[320px] truncate rounded-md bg-(--secondary) px-2.5 py-1.5 text-[12px] text-(--muted-foreground)">
                    {inviteUrl}
                  </code>
                  <Button variant="ghost" size="sm" onClick={copyInvite}>
                    <Link2 size={13} />
                    {t('settings.copyInvite')}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.members')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col divide-y divide-(--border)">
            {(members.data ?? []).map((member) => (
              <div key={member.userId} className="flex items-center gap-3 py-3">
                <Avatar fallback={member.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px]">{member.name}</div>
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
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        void workspaceApi.removeMember(workspaceId, member.userId).then(refresh)
                      }}
                    >
                      {t('settings.removeMember')}
                    </Button>
                  </>
                )}
                {role === 'owner' && member.role !== 'owner' && member.userId !== user?.id && (
                  <Button variant="ghost" size="sm" onClick={() => setTransferId(member.userId)}>
                    {t('settings.transferOwner')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={transferId !== null} onOpenChange={(open) => !open && setTransferId(null)}>
        <DialogContent>
          <DialogTitle>{t('settings.transferConfirm', { name: transferTarget?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('settings.transferOwner')}</DialogDescription>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Tag size={13} className="text-(--muted-foreground)" />
          {t('tags.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex max-w-[460px] flex-wrap items-center gap-2">
          <Input
            value={name}
            placeholder={t('tags.namePlaceholder')}
            className="w-[180px]"
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`${t('tags.color')} ${c}`}
                className={cn(
                  'size-5 rounded-full ring-offset-2 transition-shadow',
                  color === c ? 'ring-2 ring-(--ring)' : 'hover:scale-110',
                )}
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
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium"
              style={{ background: `var(--tag-${tag.color}-bg)`, color: `var(--tag-${tag.color}-fg)` }}
            >
              {tag.name}
              <button
                type="button"
                aria-label={t('common:delete')}
                onClick={() => {
                  void tagApi
                    .remove(workspaceId, tag.id)
                    .then(() => queryClient.invalidateQueries({ queryKey: ['tags', workspaceId] }))
                }}
                className="rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {tags.data?.length === 0 && (
            <span className="text-[13px] text-(--muted-foreground)">{t('tags.empty')}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import type { Profile } from '../lib/types'
import { useI18n } from '../i18n'
import { Avatar, GroupAvatar, Modal, ProfileName, errText } from './ui'
import { IconCopy, IconEdit, IconForward, IconReply, IconTrash } from './icons'
import { REACTION_SET } from './MessageExtras'
import { PREMIUM_REACTIONS } from '../lib/premiumData'

export interface MenuTarget<M> {
  msg: M
  rect: DOMRect
}

/** Structural minimum shared by direct and group messages. */
export interface MenuMessage {
  id: string
  sender_id: string
  body: string
  attachment_url: string
  attachment_name: string
  attachment_type: string
  attachment_duration?: number
}

/**
 * Long-press (touch) + right-click (desktop) opener for the message menu.
 * - fires after ~480ms of still press (any scroll/drag >10px cancels it)
 * - suppresses the click that follows a long press, so it never also
 *   toggles players/pickers underneath
 * - short taps behave exactly as before (nothing is intercepted)
 */
export function useMessageMenu<M>(onOpen: (target: MenuTarget<M>) => void) {
  const timer = useRef<number>()
  const start = useRef<{ x: number; y: number } | null>(null)
  const firedAt = useRef(0)

  const clear = () => { window.clearTimeout(timer.current); start.current = null }

  const bind = (msg: M) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start.current = { x: e.clientX, y: e.clientY }
      const el = e.currentTarget
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        firedAt.current = Date.now()
        try { navigator.vibrate?.(8) } catch { /* unsupported */ }
        onOpen({ msg, rect: el.getBoundingClientRect() })
      }, 480)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault()
      firedAt.current = Date.now()
      onOpen({ msg, rect: e.currentTarget.getBoundingClientRect() })
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (Date.now() - firedAt.current < 400) { e.preventDefault(); e.stopPropagation() }
    },
  })

  useEffect(() => () => window.clearTimeout(timer.current), [])
  return bind
}

/** Copy text with a legacy fallback for older Android WebViews. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch { return false }
  }
}

export type MessageAction = 'reply' | 'forward' | 'edit' | 'delete'

/**
 * Compact floating glass menu shown next to a message: quick emoji row on
 * top, then only the actions that are actually available for this message.
 * Delete is two-step (tap again to confirm) — destructive but no modal.
 */
export function MessageContextMenu<M extends MenuMessage>({ target, mine, myEmoji, premiumReactions = false, onReact, onAction, onCopy, onClose }: {
  target: MenuTarget<M>
  mine: boolean
  myEmoji: string | null
  /** NEXO Premium adds a second reaction row. */
  premiumReactions?: boolean
  onReact: (emoji: string, at: { x: number; y: number }) => void
  onAction: (action: MessageAction) => void
  onCopy: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  // The tap that OPENS the menu is still in progress when the backdrop
  // appears, and its release (click / native contextmenu) lands on the
  // backdrop. The backdrop may therefore only close when the closing
  // tap's own pointerdown actually hit the backdrop itself.
  const backdropPressed = useRef(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [armed, setArmed] = useState(false)
  const [tools, setTools] = useState(false)
  const [result, setResult] = useState('')
  const [toolError, setToolError] = useState('')
  const [working, setWorking] = useState(false)
  const [copied, setCopied] = useState(false)
  const { msg, rect } = target
  const canCopy = Boolean(msg.body?.trim())
  const canEdit = mine && canCopy

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const W = 252
    const h = el.offsetHeight || 320
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = rect.right - W
    if (!mine) left = rect.left
    left = Math.max(8, Math.min(left, vw - W - 8))
    let top = rect.top - h - 8
    if (top < 8) top = Math.min(rect.bottom + 8, vh - h - 8)
    setPos({ left, top: Math.max(8, top) })
  }, [rect, mine, tools, result, toolError])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const items: { action: MessageAction; icon: React.ReactNode; label: string; danger?: boolean }[] = []
  items.push({ action: 'reply', icon: <IconReply size={17} />, label: t('msg.reply') })
  items.push({ action: 'forward', icon: <IconForward size={17} />, label: t('msg.forward') })
  if (canEdit) items.push({ action: 'edit', icon: <IconEdit size={17} />, label: t('msg.edit') })
  if (mine) items.push({ action: 'delete', icon: <IconTrash size={17} />, label: armed ? t('msg.deleteConfirm') : t('msg.delete'), danger: true })

  return (
    <>
      <div className="msg-menu-backdrop"
        onPointerDown={() => { backdropPressed.current = true }}
        onClick={() => { if (backdropPressed.current) onClose(); backdropPressed.current = false }}
        onContextMenu={(e) => { e.preventDefault() }} />
      <div ref={ref} className="msg-menu glass" role="menu" aria-label={t('msg.menu')}
        style={pos ? { left: pos.left, top: pos.top } : { left: 8, top: 8, visibility: 'hidden' }}>
        <div className="msg-menu-emojis" role="group" aria-label={t('msg.react')}>
          {REACTION_SET.map((e) => (
            <button key={e} className={`msg-menu-emoji ${myEmoji === e ? 'mine' : ''}`}
              onClick={(ev) => {
                const r = (ev.currentTarget as HTMLButtonElement).getBoundingClientRect()
                onReact(e, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
              }} aria-label={e}>{e}</button>
          ))}
        </div>
        {premiumReactions && (
          <div className="msg-menu-emojis" role="group" aria-label={t('premium.f.reactions')}>
            {PREMIUM_REACTIONS.map((e) => (
              <button key={e} className={`msg-menu-emoji ${myEmoji === e ? 'mine' : ''}`}
                onClick={(ev) => {
                  const r = (ev.currentTarget as HTMLButtonElement).getBoundingClientRect()
                  onReact(e, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
                }} aria-label={e}>{e}</button>
            ))}
          </div>
        )}
        {canCopy && <button className="msg-menu-item nexo-tool-entry" role="menuitem" onClick={() => { setTools(v => !v); setResult(''); setToolError('') }}><span>NEXO ✦</span><span>{t('nexo.tools')}</span></button>}
        {canCopy && tools && <div className="nexo-tools">
          <p>{t('nexo.privacy')}</p>
          {(['correct', 'improve', 'shorten'] as const).map(action => <button key={action} className="btn btn-sm" disabled={working || msg.body.length > 2000} onClick={async () => {
            setWorking(true); setToolError(''); setResult(''); setCopied(false)
            try { setResult(await api.rewriteAi(msg.body, action)) } catch { setToolError(t('nexo.error')) } finally { setWorking(false) }
          }}>{t(`nexo.${action}`)}</button>)}
          {msg.body.length > 2000 && <p role="alert">{t('nexo.tooLong')}</p>}
          {working && <p role="status">{t('ai.thinking')}</p>}
          {toolError && <p role="alert">{toolError}</p>}
          {result && <div><strong>{t('nexo.result')}</strong><p className="nexo-result">{result}</p><button className="btn btn-sm" onClick={async () => setCopied(await copyText(result))}>{copied ? t('nexo.copied') : t('nexo.copy')}</button></div>}
        </div>}
        {canCopy && (
          <button className="msg-menu-item" role="menuitem" onClick={onCopy}>
            <IconCopy size={17} /><span>{t('msg.copy')}</span>
          </button>
        )}
        {items.map((it) => (
          <button key={it.action} className={`msg-menu-item ${it.danger ? 'danger' : ''}`} role="menuitem"
            onClick={() => {
              if (it.action === 'delete' && !armed) { setArmed(true); return }
              onAction(it.action)
            }}>
            {it.icon}<span>{it.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

/** Destination picker for forwarding: my direct chats and groups. */
export function ForwardPicker({ meId, onPick, onClose }: {
  meId: string
  onPick: (target: { kind: 'direct' | 'group'; id: string }) => Promise<void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const [directs, setDirects] = useState<{ id: string; other: Profile }[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string; avatar_url: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [dc, gr] = await Promise.all([api.listDirectChats(meId), api.listGroups(meId)])
        if (!alive) return
        setDirects(dc.map((d) => ({ id: d.conv.id, other: d.other })))
        setGroups(gr.map((g) => ({ id: g.group.id, name: g.group.name, avatar_url: g.group.avatar_url })))
      } catch (e) {
        if (alive) setError(errText(e, t))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId])

  const pick = async (kind: 'direct' | 'group', id: string) => {
    setBusy(`${kind}:${id}`)
    try { await onPick({ kind, id }) } finally { setBusy('') }
  }

  return (
    <Modal title={t('msg.forwardTitle')} onClose={onClose}>
      {error && <div className="error-box" role="alert">{error}</div>}
      {loading ? (
        <div className="center-loader"><div className="spinner" />{t('common.loading')}</div>
      ) : directs.length + groups.length === 0 ? (
        <p style={{ color: 'var(--text-3)', fontSize: 13.5, textAlign: 'center', padding: '12px 0' }}>{t('msg.forwardEmpty')}</p>
      ) : (
        <div className="list">
          {directs.map((d) => (
            <button key={d.id} className="row-card glass" disabled={Boolean(busy)} onClick={() => pick('direct', d.id)}>
              <Avatar profile={d.other} size={42} showOnline />
              <span className="row-main">
                <span className="row-title">{d.other.display_name}</span>
                <span className="row-preview">@{d.other.username}</span>
              </span>
            </button>
          ))}
          {groups.map((g) => (
            <button key={g.id} className="row-card glass" disabled={Boolean(busy)} onClick={() => pick('group', g.id)}>
              <GroupAvatar name={g.name} url={g.avatar_url} size={42} />
              <span className="row-main">
                <span className="row-title">{g.name}</span>
                <span className="row-preview">{t('nav.groups')}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

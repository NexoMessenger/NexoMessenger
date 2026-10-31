import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { Profile } from '../lib/types'
import { Avatar, EmptyState, ErrorBox, Modal, ProfileName, UserPicker, fmtTime, errText } from '../components/ui'
import { useI18n } from '../i18n'
import { IconPlus, IconBack, IconChats, IconGroups, IconChannel, IconSearch, IconChecks, IconSettings, NexoMark } from '../components/icons'

export default function ChatsPage() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [items, setItems] = useState<api.DirectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [ picked, setPicked ] = useState<Profile[]>([])
  const [starting, setStarting] = useState(false)

  const load = async () => {
    if (!profile) return
    try {
      setItems(await api.listDirectChats(profile.id))
      setError('')
    } catch (e) {
      setError(errText(e, t))
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const unsub = api.subscribeGlobal(load)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const startChat = async () => {
    if (!profile || picked.length !== 1) return
    setStarting(true)
    try {
      const id = await api.getOrCreateDirect(profile.id, picked[0].id)
      setShowNew(false); setPicked([])
      navigate(`/chat/${id}`)
    } catch (e) {
      setError(errText(e, t))
    } finally { setStarting(false) }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('chats.title')}</h1>
          <p className="page-sub">{t('chats.sub')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><IconPlus size={16} /> {t('chats.new')}</button>
      </div>

      <button className="row-card glass ai-entry" onClick={() => navigate('/ai')}>
        <span className="ai-avatar"><NexoMark size={25} /></span>
        <span className="row-main"><span className="row-title">NEXO AI</span><span className="row-preview">{t('ai.entry')}</span></span>
      </button>
      {api.mode === 'server' && <button className="row-card glass zeron-entry" onClick={() => navigate('/zeron')}>
        <span className="ai-avatar"><NexoMark size={25} /></span>
        <span className="row-main"><span className="row-title">Zeron</span><span className="row-preview">{t('zeron.entry')}</span></span>
      </button>}
      <ErrorBox error={error} />
      {loading ? (
        <div className="center-loader"><div className="spinner" />{t('chats.loading')}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<IconChats size={30} />} title={t('chats.emptyTitle')} text={t('chats.emptyText')}>
          <div style={{ marginTop: 18 }}><button className="btn btn-primary" onClick={() => setShowNew(true)}><IconPlus size={16} /> {t('chats.startFirst')}</button></div>
        </EmptyState>
      ) : (
        <div className="list">
          {items.map(({ conv, other, lastMessage, unread }) => (
            <button key={conv.id} className="row-card glass" onClick={() => navigate(`/chat/${conv.id}`)}>
              <Avatar profile={other} showOnline />
              <span className="row-main">
                <span className="row-title"><ProfileName profile={other} />
                  <span style={{ color: 'var(--text-3)', fontWeight: 500, fontSize: 12.5 }}>@{other.username}</span></span>
                <span className="row-preview">
                  {lastMessage ? (lastMessage.sender_id === profile?.id ? `${t('common.you')}: ` : '') + (lastMessage.body || (lastMessage.attachment_url ? t('common.attachment') : '')) : t('chats.sayHello')}
                </span>
              </span>
              <span className="row-meta">
                <span className="row-time">{fmtTime(conv.last_message_at)}</span>
                {unread > 0 && <span className="unread-dot">{unread}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {showNew && profile && (
        <Modal title={t('chats.newTitle')} onClose={() => { setShowNew(false); setPicked([]) }}>
          <UserPicker meId={profile.id} selected={picked}
            onToggle={(p) => setPicked((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [p])} />
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => { setShowNew(false); setPicked([]) }}>{t('common.cancel')}</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={picked.length !== 1 || starting} onClick={startChat}>
              {starting ? t('chats.opening') : t('chats.open')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

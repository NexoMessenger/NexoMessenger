import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { Channel, Group, Profile } from '../lib/types'
import { Avatar, ErrorBox, EmptyState, GroupAvatar } from '../components/ui'
import { useI18n } from '../i18n'

export default function SearchPage() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [people, setPeople] = useState<Profile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState('')
  const timer = useRef<number>()

  useEffect(() => {
    if (!profile) return
    if (!q.trim()) { setPeople([]); setGroups([]); setChannels([]); setSearched(false); return }
    setLoading(true)
    timer.current = window.setTimeout(async () => {
      try {
        const [p, g, c] = await Promise.all([
          api.searchUsers(q, profile.id),
          api.searchPublicGroups(q),
          api.searchPublicChannels(q),
        ])
        setPeople(p); setGroups(g); setChannels(c); setError(''); setSearched(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('error.generic'))
      } finally { setLoading(false) }
    }, 300)
    return () => window.clearTimeout(timer.current)
  }, [q, profile])

  const openChat = async (p: Profile) => {
    if (!profile) return
    setBusy(p.id)
    try { navigate(`/chat/${await api.getOrCreateDirect(profile.id, p.id)}`) }
    catch (e) { setError(e instanceof Error ? e.message : t('error.generic')) }
    finally { setBusy('') }
  }

  const joinGroup = async (g: Group) => {
    if (!profile) return
    setBusy(g.id)
    try { await api.addGroupMember(g.id, profile.id); navigate(`/group/${g.id}`) }
    catch (e) { setError(e instanceof Error ? e.message : t('error.generic')) }
    finally { setBusy('') }
  }

  const subscribe = async (c: Channel) => {
    if (!profile) return
    setBusy(c.id)
    try { await api.subscribeChannel(c.id, profile.id); navigate(`/channel/${c.id}`) }
    catch (e) { setError(e instanceof Error ? e.message : t('error.generic')) }
    finally { setBusy('') }
  }

  const nothing = searched && !loading && people.length === 0 && groups.length === 0 && channels.length === 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('search.title')}</h1>
          <p className="page-sub">{t('search.sub')}</p>
        </div>
      </div>

      <div className="search-input-wrap">
        <span className="search-icon">⌕</span>
        <input className="input" placeholder={t('search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>

      <ErrorBox error={error} />
      {loading && <div className="center-loader"><div className="spinner" />{t('search.searching')}</div>}

      {!q.trim() && !loading && (
        <EmptyState icon="⌕" title={t('search.discoverTitle')} text={t('search.discoverText')} />
      )}
      {nothing && <EmptyState icon="∅" title={t('search.noResults')} text={`${t('search.noResultsText')} (“${q}”)`} />}

      {people.length > 0 && (
        <>
          <div className="section-label">{t('search.people')}</div>
          <div className="list">
            {people.map((p) => (
              <div key={p.id} className="row-card glass">
                <Avatar profile={p} size={44} showOnline />
                <span className="row-main">
                  <span className="row-title">{p.display_name}</span>
                  <span className="row-preview">@{p.username}{p.bio ? ` · ${p.bio}` : ''} · {p.is_online ? t('common.online') : t('common.offline')}</span>
                </span>
                <button className="btn btn-sm btn-primary" disabled={busy === p.id} onClick={() => openChat(p)}>
                  {busy === p.id ? '…' : t('search.message')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {groups.length > 0 && (
        <>
          <div className="section-label">{t('search.publicGroups')}</div>
          <div className="list">
            {groups.map((g) => (
              <div key={g.id} className="row-card glass">
                <GroupAvatar name={g.name} url={g.avatar_url} size={44} />
                <span className="row-main">
                  <span className="row-title">{g.name} <span className="pill">{t('groups.publicGroup')}</span></span>
                  <span className="row-preview">{g.description || t('search.noDescription')}</span>
                </span>
                <button className="btn btn-sm btn-primary" disabled={busy === g.id} onClick={() => joinGroup(g)}>
                  {busy === g.id ? '…' : t('search.joinOpen')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {channels.length > 0 && (
        <>
          <div className="section-label">{t('search.publicChannels')}</div>
          <div className="list">
            {channels.map((c) => (
              <div key={c.id} className="row-card glass">
                <GroupAvatar name={c.name} url={c.avatar_url} size={44} />
                <span className="row-main">
                  <span className="row-title">{c.name} <span className="pill">{t('nav.channels')}</span></span>
                  <span className="row-preview">{c.description || t('search.noDescription')}</span>
                </span>
                <button className="btn btn-sm btn-primary" disabled={busy === c.id} onClick={() => subscribe(c)}>
                  {busy === c.id ? '…' : t('channels.subscribe')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

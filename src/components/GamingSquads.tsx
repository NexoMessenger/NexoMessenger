import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { squadText } from '../lib/squadText'
import * as api from '../lib/api'
import banner from '../assets/gaming/squad-banner.webp'

export function SquadDiscovery() {
 const {locale}=useI18n(),w=squadText[locale]
 return <section className="squad-discovery" style={{backgroundImage:`linear-gradient(90deg,rgba(9,8,25,.96),rgba(9,8,25,.32)),url(${banner})`}}><span>{w.eyebrow}</span><h2>{w.title}</h2><p>{w.intro}</p></section>
}
export default function GamingSquads({community}:{community:api.GameCommunity}) {
 const {locale}=useI18n(), w=squadText[locale], {profile}=useAuth(), navigate=useNavigate()
 const [squads,setSquads]=useState<api.GameSquad[]>([]), [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [error,setError]=useState(''), [show,setShow]=useState(false)
 const [title,setTitle]=useState(''), [note,setNote]=useState(''), [platform,setPlatform]=useState<'pc'|'mobile'|'cross'>(community.game?.platform || 'cross'), [capacity,setCapacity]=useState(4)
 const load=useCallback(async()=>{try{setSquads(await api.listGameSquads(community.id))}catch{setError(w.failed)}finally{setLoading(false)}},[community.id,w.failed])
 useEffect(()=>{let live=true, running=false, again=false; const refresh=async()=>{if(running){again=true;return} running=true;do{again=false;try{const data=await api.listGameSquads(community.id);if(live)setSquads(data)}catch{if(live)setError(w.failed)}finally{if(live)setLoading(false)}}while(live&&again);running=false};void refresh();const unsub=api.subscribeGlobal(()=>void refresh());const timer=window.setInterval(()=>void refresh(),60000);return ()=>{live=false;unsub();clearInterval(timer)}},[community.id,w.failed])
 const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await fn();await load()}catch{setError(w.failed);await load()}finally{setBusy(false)}}
 return <section className="squad-panel" aria-label={w.feature}>
  <div className="squad-heading"><div><span className="squad-label">{w.eyebrow}</span><h2>{w.feature}</h2><p>{w.hint}</p></div><button className="btn btn-primary" onClick={()=>setShow(!show)}>{show?w.cancel:w.create}</button></div>
  {show && <form className="squad-form" onSubmit={e=>{e.preventDefault();void run(async()=>{await api.createGameSquad(community.id,{title,note,platform,capacity});setTitle('');setNote('');setShow(false)})}}><p>{w.max}</p><input className="input" maxLength={80} required placeholder={w.name} aria-label={w.name} value={title} onChange={e=>setTitle(e.target.value)}/><textarea className="input" maxLength={300} placeholder={w.note} aria-label={w.note} value={note} onChange={e=>setNote(e.target.value)}/><div className="squad-form-row"><label>{w.platform}<select className="input" value={platform} onChange={e=>setPlatform(e.target.value as typeof platform)}><option value="pc">PC</option><option value="mobile">Mobile</option><option value="cross">{w.cross}</option></select></label><label>{w.seats}<select className="input" value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[2,3,4,5,6,7,8].map(x=><option key={x} value={x}>{x}</option>)}</select></label></div><button className="btn btn-primary" disabled={busy||!title.trim()}>{w.publish}</button></form>}
  {error && <p className="squad-error" role="alert">{error}</p>}{loading?<p>{w.loading}</p>:squads.length===0?<div className="squad-empty"><span aria-hidden="true">✦</span>{w.empty}</div>:<div className="squad-grid">{squads.map(s=><article className="squad-card" key={s.id}><div className="squad-card-top"><span className="squad-platform">{s.platform==='cross'?w.cross:s.platform==='pc'?'PC':'Mobile'}</span><span className="squad-count">{s.members.length} / {s.capacity}</span></div><h3>{s.title}</h3>{s.note && <p className="squad-note">{s.note}</p>}<div className="squad-progress" aria-hidden="true"><span style={{width:`${s.members.length/s.capacity*100}%`}} /></div><span className="squad-members-title">{w.members}</span><div className="squad-members">{s.members.map(m=><button key={m.id} onClick={()=>navigate(`/user/${m.id}`)} title={m.username}> {m.display_name}{m.id===s.owner_id?` · ${w.owner}`:''}</button>)}</div><small>{w.expires}: {new Date(s.expires_at).toLocaleString(locale)}</small><div className="squad-actions">{s.owner_id===profile?.id||community.can_moderate ? <button className="btn btn-sm" disabled={busy} onClick={()=>{if(window.confirm(w.confirm))void run(()=>api.deleteGameSquad(s.id))}}>{w.remove}</button>:null}{s.owner_id!==profile?.id&&<button className="btn btn-primary btn-sm" disabled={busy||(!s.joined&&s.members.length>=s.capacity)} onClick={()=>void run(()=>api.joinGameSquad(s.id,!s.joined))}>{s.joined?w.leave:s.members.length>=s.capacity?w.full:w.join}</button>}</div></article>)}</div>}
 </section>
}

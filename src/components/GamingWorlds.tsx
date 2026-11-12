import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { worldText } from '../lib/gamingWorldText'
import * as api from '../lib/api'
import arena from '../assets/gaming/nexo-arena.webp'
import { SquadDiscovery } from './GamingSquads'

type Props = { communities: api.GameCommunity[] }
export function GamingWorlds({communities}:Props) {
 const {locale}=useI18n(), w=worldText[locale], navigate=useNavigate()
 const [query,setQuery]=useState(''), [filter,setFilter]=useState<'all'|'joined'|'pc'|'mobile'>('all')
 const results=communities.filter(c => (filter==='all'||(filter==='joined'?c.joined:c.game?.platform===filter)) && `${c.name} ${c.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
 return <>
  <section className="world-hero" style={{backgroundImage:`linear-gradient(90deg, rgba(9,8,25,.96), rgba(13,10,35,.48)), url(${arena})`}}>
   <span className="world-eyebrow">{w.eyebrow}</span><h2>{w.headline}</h2><p>{w.intro}</p><button type="button" className="world-hero-action" onClick={()=>document.getElementById('gaming-worlds')?.scrollIntoView({behavior:'smooth',block:'start'})}>{w.explore} <span aria-hidden="true">↗</span></button>
  </section>
  <SquadDiscovery />
  <div className="world-discovery" id="gaming-worlds"><div><span className="world-eyebrow">NEXO / DISCOVER</span><h2>{w.explore}</h2><p>{w.exploreHint}</p></div><input className="input" type="search" aria-label={w.search} placeholder={w.search} value={query} onChange={e=>setQuery(e.target.value)}/></div>
  <div className="world-filters" role="group" aria-label={w.explore}>{([['all',w.all],['joined',w.joined],['pc','PC'],['mobile','Mobile']] as const).map(([key,label])=><button key={key} type="button" className={filter===key?'active':''} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>
  {results.length===0?<p className="gaming-muted">{filter==='joined'&&!query?w.noJoined:w.noResults}</p>:<div className="world-grid">{results.map((c,i)=><button className="world-card" key={c.id} onClick={()=>navigate(`/gaming/${c.id}`)}>
    <div className={`world-cover world-cover-${i%4}`}><span className="world-cover-fallback">{c.name.slice(0,2).toUpperCase()}</span>{c.game?.image_url && <img src={c.game.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none'}}/>}<span className="world-cover-shade"/><span className="world-type">{c.game?.platform==='pc'?'PC':c.game?.platform==='mobile'?'MOBILE':'NEXO'}</span>{c.joined&&<span className="world-joined">✓ {w.joinedTag}</span>}</div>
    <div className="world-card-content"><div className="world-card-kicker">{c.official?w.byNexo:w.userCommunity}</div><strong>{c.name}</strong><p>{c.description || w.communityDesc}</p><div className="world-card-bottom"><span>{c.member_count ?? 0} {w.members} · {c.topic_count ?? 0} {w.discussions}</span><span className="world-arrow" aria-label={w.open}>↗</span></div></div>
   </button>)}</div>}
 </>
}
export function GamingWorldHeader({community,onMembership,onFailure}:{community:api.GameCommunity;onMembership:(c:api.GameCommunity)=>void;onFailure:()=>void}) {
 const {locale}=useI18n(), w=worldText[locale], [busy,setBusy]=useState(false), game=community.game
 const join=async()=>{setBusy(true);try{onMembership(await api.setCommunityMembership(community.id,!community.joined))}catch{onFailure()}finally{setBusy(false)}}
 return <section className="world-detail"><div className="world-detail-cover" style={{backgroundImage:`linear-gradient(90deg,rgba(10,9,27,.95),rgba(10,9,27,.55)),url(${game?.image_url || arena})`}}><span className="world-eyebrow">{community.official?w.byNexo:w.userCommunity} · {w.public}</span><h2>{community.name}</h2><p>{community.description||w.communityDesc}</p><div className="world-stats"><span>{community.member_count ?? 0} {w.members}</span><span>{community.topic_count ?? 0} {w.discussions}</span></div><div className="world-detail-actions"><button className="btn btn-primary" onClick={()=>void join()} disabled={busy}>{community.joined?w.leave:w.join}</button>{game && (game.platform==='pc'?<a className="btn" href={`steam://run/${game.steam_app_id}`} onClick={()=>void api.launchGame(game.id).catch(onFailure)}>{w.play}</a>:<><a className="btn" href={game.url} target="_blank" rel="noopener noreferrer" onClick={()=>void api.visitMobileGame(game.id).catch(onFailure)}>{w.store}</a>{game.ios_url && <a className="btn" href={game.ios_url} target="_blank" rel="noopener noreferrer" onClick={()=>void api.visitMobileGame(game.id).catch(onFailure)}>{w.ios}</a>}</>)}</div></div>{game && <p className="world-note">{w.launchNote}</p>}{community.official && <p className="world-note">{w.fan}</p>}</section>
}

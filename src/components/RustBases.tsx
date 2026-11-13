import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { rustText } from '../lib/rustBaseText'
import { rustVideoBases, type VideoBase } from '../lib/rustBases'
import './RustBases.css'
import { RuneFeature, RustRuneGuide } from './RustRuneGuide'

export default function RustBases() {
 const {locale}=useI18n(); const t=rustText[locale]; const [concept,setConcept]=useState(false); const [query,setQuery]=useState(''); const [group,setGroup]=useState<'all'|VideoBase['group']>('all')
 const matches=useMemo(()=>rustVideoBases.filter(x=>(group==='all'||x.group===group) && `${x.title} ${x.year} ${x.source}`.toLowerCase().includes(query.trim().toLowerCase())),[query,group])
 return <section className="rust-bases" aria-label={t.home}>
  <div className="rust-heading"><span>{t.home} · RUST PC</span><h2>{t.title}</h2><p>{t.intro}</p></div>
  {!concept ? <><RuneFeature onOpen={()=>setConcept(true)}/>
   <h3>{t.catalog}</h3><p className="rust-note">{t.catalogHint}</p>
   <input className="input rust-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search} aria-label={t.search}/>
   <div className="rust-filters" role="group" aria-label={t.catalog}>{(['all','solo-duo','group','starter'] as const).map(g=><button key={g} className={`btn ${group===g?'btn-primary':''}`} aria-pressed={group===g} onClick={()=>setGroup(g)}>{g==='all'?t.all:g==='solo-duo'?t.solo:g==='group'?t.group:t.starter}</button>)}</div>
   <p className="rust-note">{matches.length} {t.results}</p><div className="rust-grid">{matches.map(base=><article key={base.id} className="rust-card glass">{base.source==='youtube'?<a href={base.url} target="_blank" rel="noopener noreferrer" aria-label={`${t.open}: ${base.title}`}><img src={`https://i.ytimg.com/vi/${base.id}/mqdefault.jpg`} alt="" loading="lazy"/></a>:<div className="rust-tiktok">TikTok</div>}<div className="rust-card-body"><small>{base.source==='youtube'?t.youtube:t.tiktok} · {base.year}</small><h4>{base.title}</h4><a className="rust-link" href={base.url} target="_blank" rel="noopener noreferrer">{t.open} ↗</a></div></article>)}</div>{!matches.length&&<p>{t.noResults}</p>}</> : <RustRuneGuide onBack={()=>setConcept(false)}/>}
 </section>
}

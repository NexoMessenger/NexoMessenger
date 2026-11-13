import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { rustText } from '../lib/rustBaseText'
import { rustVideoBases, type VideoBase } from '../lib/rustBases'
import './RustBases.css'

function Diagram({stage, label}: {stage:number; label:string}) {
 return <svg className="rust-diagram" viewBox="0 0 320 235" role="img" aria-label={label}>
  <rect x="10" y="10" width="300" height="215" rx="20" fill="#101c28" />
  {stage>=5 && <rect x="35" y="25" width="250" height="182" rx="7" fill="none" stroke="#d4ad66" strokeWidth="3" strokeDasharray="7 7" />}
  {[0,1,2,3].map(i=><rect key={i} x={95+(i%2)*55} y={45+Math.floor(i/2)*55} width="55" height="55" fill={stage>=4?'#416e88':'#294f6a'} stroke="#a3d1e5" strokeWidth="2"/>)}
  <rect x="122" y="155" width="55" height="45" fill="#625073" stroke="#cbb6e7" strokeWidth="2"/>
  {stage>=2 && <><path d="M95 155V45H205V155H177 M122 155H95 M122 200H177 M122 155V200 M177 155V200" fill="none" stroke="#f3ede0" strokeWidth="5"/><path d="M138 155h24 M138 200h24" stroke="#dfb86f" strokeWidth="5"/></>}
  {stage>=3 && <><rect x="104" y="53" width="27" height="16" rx="2" fill="#76c69f"/><rect x="166" y="55" width="29" height="15" rx="2" fill="#c69765"/><rect x="168" y="108" width="26" height="15" rx="2" fill="#c69765"/></>}
  {stage>=4 && <path d="M103 85h93 M103 140h93" stroke="#a3d1e5" opacity=".35" strokeWidth="5"/>}
 </svg>
}
export default function RustBases() {
 const {locale}=useI18n(); const t=rustText[locale]; const [concept,setConcept]=useState(false); const [query,setQuery]=useState(''); const [group,setGroup]=useState<'all'|VideoBase['group']>('all')
 const matches=useMemo(()=>rustVideoBases.filter(x=>(group==='all'||x.group===group) && `${x.title} ${x.year} ${x.source}`.toLowerCase().includes(query.trim().toLowerCase())),[query,group])
 return <section className="rust-bases" aria-label={t.home}>
  <div className="rust-heading"><span>{t.home} · RUST PC</span><h2>{t.title}</h2><p>{t.intro}</p></div>
  {!concept ? <><div className="rust-feature glass"><div><span className="rust-kicker">{t.custom}</span><h3>{t.customTitle}</h3><p>{t.customDesc}</p><button className="btn btn-primary" onClick={()=>setConcept(true)}>{t.guide} →</button></div><div className="rust-feature-plan"><Diagram stage={5} label={t.floor}/></div></div>
   <h3>{t.catalog}</h3><p className="rust-note">{t.catalogHint}</p>
   <input className="input rust-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search} aria-label={t.search}/>
   <div className="rust-filters" role="group" aria-label={t.catalog}>{(['all','solo-duo','group','starter'] as const).map(g=><button key={g} className={`btn ${group===g?'btn-primary':''}`} aria-pressed={group===g} onClick={()=>setGroup(g)}>{g==='all'?t.all:g==='solo-duo'?t.solo:g==='group'?t.group:t.starter}</button>)}</div>
   <p className="rust-note">{matches.length} {t.results}</p><div className="rust-grid">{matches.map(base=><article key={base.id} className="rust-card glass">{base.source==='youtube'?<a href={base.url} target="_blank" rel="noopener noreferrer" aria-label={`${t.open}: ${base.title}`}><img src={`https://i.ytimg.com/vi/${base.id}/mqdefault.jpg`} alt="" loading="lazy"/></a>:<div className="rust-tiktok">TikTok</div>}<div className="rust-card-body"><small>{base.source==='youtube'?t.youtube:t.tiktok} · {base.year}</small><h4>{base.title}</h4><a className="rust-link" href={base.url} target="_blank" rel="noopener noreferrer">{t.open} ↗</a></div></article>)}</div>{!matches.length&&<p>{t.noResults}</p>}</> : <><button className="btn" onClick={()=>setConcept(false)}>← {t.close}</button><h3>{t.customTitle} · {t.plan}</h3><p className="rust-warning">{t.warning}</p><p className="rust-note">{t.illustration} {t.legend}</p><div className="rust-steps">{t.steps.map((text,i)=><article className="rust-step glass" key={i}><Diagram stage={i} label={`${t.floor}: ${t.labels[i]}`}/><div><small>{t.step} {i+1} / {t.steps.length}</small><h4>{t.labels[i]}</h4><p>{text}</p></div></article>)}</div></>}
 </section>
}

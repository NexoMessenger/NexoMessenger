import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { steamText } from '../lib/steamText'
import * as api from '../lib/api'

export default function SteamInventory() {
 const {locale,t}=useI18n();const text=steamText[locale]
 const [connection,setConnection]=useState<{connected:boolean;steamId:string|null;games:api.SteamGame[]}|null>(null)
 const [url,setUrl]=useState('');const [editing,setEditing]=useState(false);const [game,setGame]=useState(730);const [items,setItems]=useState<api.SteamItem[]>([]);const [next,setNext]=useState<string|null>(null);const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('')
 const message=(e:unknown)=>{const code=e instanceof Error?e.message:'';return code==='INVALID_TRADE_URL'?text.invalid:code==='INVENTORY_PRIVATE'?text.private:code==='STEAM_RATE_LIMIT'?text.rate:code==='STEAM_STORAGE_UNAVAILABLE'?text.storage:text.unavailable}
 useEffect(()=>{let live=true;api.steamConnection().then(x=>{if(live)setConnection(x)}).catch(e=>{if(live)setError(message(e))});return ()=>{live=false}},[locale])
 const save=async()=>{setBusy(true);setError('');try{const result=await api.saveSteamTradeUrl(url);setConnection(prev=>prev?{...prev,...result}:prev);setUrl('');setEditing(false);setItems([]);setNext(null);setLoaded(false)}catch(e){setError(message(e))}finally{setBusy(false)}}
 const remove=async()=>{if(!window.confirm(text.confirm))return;setBusy(true);setError('');try{await api.deleteSteamConnection();setConnection(prev=>prev?{...prev,connected:false,steamId:null}:prev);setItems([]);setNext(null);setLoaded(false);setEditing(false);setUrl('')}catch(e){setError(message(e))}finally{setBusy(false)}}
 const load=async(cursor?:string)=>{setBusy(true);setError('');try{const result=await api.steamInventory(game,locale,cursor);setItems(prev=>cursor?[...prev,...result.items]:result.items);setNext(result.next);setLoaded(true)}catch(e){setError(message(e))}finally{setBusy(false)}}
 return <section className="steam-inventory"><h2>{text.title}</h2><p>{text.hint}</p><p className="steam-warning">{text.secret}</p><a className="btn btn-sm" target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/my/tradeoffers/privacy">{text.tradeUrl} ↗</a>
 {error&&<div className="error-box" role="alert">{error}</div>}
 {!connection&&!error&&<p>{t('common.loading')}</p>}
 {connection && <>{connection.connected && <div className="steam-connected"><span>{text.connected}: {connection.steamId}</span><button className="btn btn-sm" onClick={()=>setEditing(!editing)}>{text.replace}</button><button className="btn btn-sm" disabled={busy} onClick={()=>void remove()}>{text.remove}</button></div>}
 {(!connection.connected||editing)&&<form className="steam-form" onSubmit={e=>{e.preventDefault();void save()}}><input type="url" autoComplete="off" spellCheck={false} className="input" value={url} onChange={e=>setUrl(e.target.value)} aria-label={text.placeholder} placeholder={text.placeholder} maxLength={512} required/><button className="btn btn-primary" disabled={busy||!url.trim()}>{text.save}</button></form>}
 {connection.connected && <><p className="steam-warning">{text.warning}</p><div className="steam-controls"><label>{text.choose}<select className="input" value={game} disabled={busy} onChange={e=>{setGame(Number(e.target.value));setItems([]);setNext(null);setLoaded(false);setError('')}}>{connection.games.map(g=><option key={g.appid} value={g.appid}>{g.name}</option>)}</select></label><button className="btn btn-primary" disabled={busy} onClick={()=>void load()}>{busy?t('common.loading'):text.load}</button></div>
 {loaded && (items.length ? <><div className="steam-item-grid">{items.map((item,i)=><article className="steam-item glass" key={`${item.id}-${i}`}>{item.icon&&<img src={item.icon} alt="" loading="lazy" referrerPolicy="no-referrer"/>}<strong>{item.name}</strong>{item.type&&<small>{item.type}</small>}{item.amount!=='1'&&<span>×{item.amount}</span>}</article>)}</div>{next&&<button className="btn" disabled={busy} onClick={()=>void load(next)}>{text.more}</button>}</>:<p>{text.empty}</p>)}
 </>}</>}
 </section>
}

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const STEAM_GAMES = [
  { appid: 730, name: 'Counter-Strike 2', context: 2 },
  { appid: 570, name: 'Dota 2', context: 2 },
  { appid: 252490, name: 'Rust', context: 2 },
  { appid: 440, name: 'Team Fortress 2', context: 2 },
]
const STEAM_BASE = 76561197960265728n
export function parseTradeUrl(value) {
  if (typeof value !== 'string' || value.length > 512) throw Error('INVALID_TRADE_URL')
  let url
  try { url = new URL(value.trim()) } catch { throw Error('INVALID_TRADE_URL') }
  if (url.protocol !== 'https:' || url.hostname !== 'steamcommunity.com' || url.port || url.username || url.password || url.pathname !== '/tradeoffer/new/' || url.hash) throw Error('INVALID_TRADE_URL')
  const partners = url.searchParams.getAll('partner'), tokens = url.searchParams.getAll('token')
  if (partners.length !== 1 || tokens.length !== 1 || [...url.searchParams.keys()].some(k => k !== 'partner' && k !== 'token') || !/^[1-9]\d{0,9}$/.test(partners[0]) || BigInt(partners[0]) > 4294967295n || !/^[A-Za-z0-9_-]{8}$/.test(tokens[0])) throw Error('INVALID_TRADE_URL')
  return { steamId: (STEAM_BASE + BigInt(partners[0])).toString(), url: `https://steamcommunity.com/tradeoffer/new/?partner=${partners[0]}&token=${tokens[0]}` }
}
// A separate 0600 key in the persistent data directory. If encrypted records
// exist but the key is missing, never silently replace it and lose access.
export function tradeKey(dataDir, hasRecords) {
  const filename = path.join(dataDir, 'steam-trade-key')
  try { const key=fs.readFileSync(filename); if(key.length!==32) throw Error('STEAM_KEY_INVALID'); fs.chmodSync(filename,0o600); return key }
  catch(e) { if(e.code!=='ENOENT') throw e; if(hasRecords) throw Error('STEAM_KEY_MISSING'); const key=crypto.randomBytes(32); try { fs.writeFileSync(filename,key,{mode:0o600,flag:'wx'});return key } catch(err) { if(err.code==='EEXIST')return tradeKey(dataDir,true);throw err } }
}
export function encryptTrade(value, key, userId) {
  const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(userId));const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return {iv:iv.toString('base64'),data:data.toString('base64'),tag:cipher.getAuthTag().toString('base64')}
}
export function decryptTrade(record,key,userId) {
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(record.iv,'base64'));decipher.setAAD(Buffer.from(userId));decipher.setAuthTag(Buffer.from(record.tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(record.data,'base64')),decipher.final()]).toString('utf8')
}
export async function fetchInventory(steamId, appid, cursor, language, fetcher=fetch) {
  const game=STEAM_GAMES.find(g=>g.appid===Number(appid))
  if(!game || !/^7656119\d{10}$/.test(steamId) || (cursor && !/^\d{1,24}$/.test(cursor))) throw Error('INVALID_INVENTORY_REQUEST')
  const lang={en:'english',ru:'russian',uk:'ukrainian','zh-CN':'schinese'}[language] || 'english'
  const params=new URLSearchParams({l:lang,count:'100'});if(cursor)params.set('start_assetid',cursor)
  const response=await fetcher(`https://steamcommunity.com/inventory/${steamId}/${game.appid}/${game.context}?${params}`,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Accept':'application/json'}})
  if(response.status===403 || response.status===401) throw Error('INVENTORY_PRIVATE')
  if(response.status===429) throw Error('STEAM_RATE_LIMIT')
  if(response.status===404) throw Error('INVENTORY_UNAVAILABLE')
  if(!response.ok || !response.body) throw Error('STEAM_UNAVAILABLE')
  let bytes=0;const chunks=[];for await (const chunk of response.body){bytes+=chunk.length;if(bytes>2*1024*1024)throw Error('STEAM_RESPONSE_TOO_LARGE');chunks.push(chunk)}
  let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Error('STEAM_UNAVAILABLE')}
  if(!data.success)throw Error('INVENTORY_UNAVAILABLE')
  const descriptions=new Map((Array.isArray(data.descriptions)?data.descriptions:[]).map(d=>[`${d.classid}:${d.instanceid || '0'}`,d]))
  const items=(Array.isArray(data.assets)?data.assets:[]).slice(0,100).map(a=>{const d=descriptions.get(`${a.classid}:${a.instanceid || '0'}`);const icon=typeof d?.icon_url==='string' && /^[A-Za-z0-9_/-]{1,512}$/.test(d.icon_url) ? `https://community.cloudflare.steamstatic.com/economy/image/${d.icon_url}/96fx96f` : '';return {id:String(a.assetid), name:String(d?.market_hash_name || d?.name || 'Item').slice(0,200), type:String(d?.type || '').slice(0,160), amount:String(a.amount || '1'), icon}})
  const next=data.more_items && /^\d{1,24}$/.test(String(data.last_assetid)) ? String(data.last_assetid) : null
  return {items,next,total:Number.isSafeInteger(data.total_inventory_count)?data.total_inventory_count:null}
}

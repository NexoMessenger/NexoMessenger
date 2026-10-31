import crypto from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const random = () => crypto.randomBytes(32).toString('base64url')
const ttl = 10 * 60 * 1000
const cookieOptions = secure => ({ httpOnly: true, secure, sameSite: 'lax', path: '/api/auth/google', maxAge: ttl })
const readCookie = (req, name) => String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1) || ''

/** Google tokens never leave the server. State + nonce + PKCE bind the flow to
 * the initiating browser; a short-lived HttpOnly ticket delivers a NEXO session. */
export function registerGoogleRoutes(app, { db, persist, uid, now, sessionTTL, touchGlobal, env = process.env, exchange = exchangeGoogle, verify = verifyGoogle }) {
  const flows = new Map(), tickets = new Map()
  const config = () => {
    try {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) return null
      const url = new URL(env.GOOGLE_REDIRECT_URI)
      if (url.pathname !== '/api/auth/google/callback' || url.search || url.hash || url.username || url.password) return null
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return null
      return { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET, redirect: url.href, origin: url.origin, host: url.host, secure: url.protocol === 'https:' }
    } catch { return null }
  }
  const validOrigin = (req, c) => req.get('origin') === c.origin && req.get('host') === c.host
  const prune = () => { const time = Date.now(); for (const map of [flows,tickets]) for (const [key,v] of map) if (v.expires < time) map.delete(key) }
  const redirectError = (res,c,reason='error') => res.redirect(303, `${c.origin}/?google_auth=${reason}#/login`)

  app.post('/api/auth/google/start', (req,res) => {
    const c = config(); if (!c) return res.status(503).json({ error: 'GOOGLE_NOT_CONFIGURED' })
    if (!validOrigin(req,c)) return res.status(403).json({ error: 'GOOGLE_ORIGIN_MISMATCH' })
    prune(); if (flows.size >= 10000) return res.status(429).json({ error: 'GOOGLE_BUSY' })
    const state = random(), nonce = random(), verifier = random()
    flows.set(state, { nonce, verifier, expires: Date.now() + ttl })
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
    const url = new URL(GOOGLE_AUTH)
    url.search = new URLSearchParams({ client_id: c.id, redirect_uri: c.redirect, response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: challenge, code_challenge_method: 'S256' }).toString()
    res.set('Cache-Control','no-store').cookie('nexo_google_state', state, cookieOptions(c.secure)).json({ url: url.href })
  })
  app.get('/api/auth/google/callback', async (req,res) => {
    const c=config(); if (!c || req.get('host') !== c.host) return res.status(503).send('Google sign-in is not configured.')
    res.set('Cache-Control','no-store'); prune()
    const state=typeof req.query.state==='string'?req.query.state:'', cookie=readCookie(req,'nexo_google_state')
    const flow=flows.get(state)
    res.clearCookie('nexo_google_state', cookieOptions(c.secure))
    if (!flow || !state || state !== cookie) return redirectError(res,c)
    flows.delete(state)
    if (req.query.error) return redirectError(res,c,'cancel')
    if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 4096) return redirectError(res,c)
    try {
      const idToken=await exchange({code:req.query.code,verifier:flow.verifier,config:c})
      const identity=await verify(idToken,c.id,flow.nonce)
      if (!identity || typeof identity.sub !== 'string' || !identity.sub || identity.sub.length > 255 || typeof identity.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identity.email) || identity.email_verified !== true) throw Error('Invalid identity')
      if (tickets.size >= 10000) throw Error('Too many pending tickets')
      const id=random(); tickets.set(id,{sub:identity.sub,email:identity.email,name:typeof identity.name==='string'?identity.name:'',expires:Date.now()+ttl})
      res.cookie('nexo_google_ticket', id, cookieOptions(c.secure))
      return res.redirect(303, `${c.origin}/?google_auth=complete#/login`)
    } catch { return redirectError(res,c) }
  })
  app.post('/api/auth/google/complete', (req,res) => {
    const c=config(); if (!c) return res.status(503).json({error:'GOOGLE_NOT_CONFIGURED'})
    if (!validOrigin(req,c)) return res.status(403).json({error:'GOOGLE_ORIGIN_MISMATCH'})
    res.set('Cache-Control','no-store'); prune()
    const id=readCookie(req,'nexo_google_ticket'), identity=tickets.get(id)
    res.clearCookie('nexo_google_ticket',cookieOptions(c.secure)); if (!identity) return res.status(400).json({error:'GOOGLE_SESSION_EXPIRED'})
    tickets.delete(id)
    let user=db.users.find(u=>u.google_sub===identity.sub)
    if (!user) {
      // Never take over or silently link a pre-existing password account.
      if (db.users.some(u=>u.email?.toLowerCase()===identity.email.toLowerCase())) return res.status(409).json({error:'GOOGLE_EMAIL_EXISTS'})
      let base=identity.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g,'').slice(0,15)
      if (base.length<3) base='user'
      let username=base
      while(db.profiles.some(p=>p.username.toLowerCase()===username)) username=`${base}_${crypto.randomBytes(4).toString('hex')}`
      const userId=uid(), time=now()
      user={id:userId,email:identity.email,google_sub:identity.sub,passwordHash:'',salt:''}
      db.users.push(user)
      db.profiles.push({id:userId,username,display_name:(identity.name.trim()||username).slice(0,60),avatar_url:'',bio:'',is_online:true,last_seen:time,created_at:time})
    }
    const profile=db.profiles.find(p=>p.id===user.id)
    if (!profile) return res.status(500).json({error:'GOOGLE_ACCOUNT_ERROR'})
    const token=random(); db.sessions.push({token,user_id:user.id,expires_at:Date.now()+sessionTTL})
    profile.is_online=true; profile.last_seen=now()
    persist(); touchGlobal()
    res.json({token})
  })
}
async function exchangeGoogle({code,verifier,config}) {
  const res=await fetch(GOOGLE_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:config.id,client_secret:config.secret,redirect_uri:config.redirect,grant_type:'authorization_code',code_verifier:verifier}),signal:AbortSignal.timeout(12000)})
  if (!res.ok) throw Error('Google token exchange failed')
  const data=await res.json(); if (typeof data.id_token!=='string') throw Error('Missing id token');return data.id_token
}
export async function verifyGoogle(token,audience,nonce,jwks=keys) {
  const {payload}=await jwtVerify(token,jwks,{issuer:['https://accounts.google.com','accounts.google.com'],audience,algorithms:['RS256']})
  if (payload.nonce!==nonce || typeof payload.exp!=='number' || typeof payload.iat!=='number') throw Error('Invalid claims')
  return payload
}

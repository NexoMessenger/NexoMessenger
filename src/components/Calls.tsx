import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import * as api from '../lib/api'

type Kind = 'audio' | 'video'
type Call = { id: string; roomId: string; kind: Kind; name: string; incoming: boolean; phase: 'incoming' | 'ringing' | 'connecting' | 'connected' }
const Context = createContext<{ start: (roomId: string, name: string, kind: Kind) => void }>({ start: () => undefined })
export const useCalls = () => useContext(Context)

export function CallsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { t } = useI18n()
  const [call, setCall] = useState<Call | null>(null)
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const callRef = useRef<Call | null>(null)
  const pc = useRef<RTCPeerConnection | null>(null)
  const local = useRef<MediaStream | null>(null)
  const remote = useRef<MediaStream | null>(null)
  const localVideo = useRef<HTMLVideoElement>(null)
  const remoteVideo = useRef<HTMLVideoElement>(null)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const generation = useRef(0)
  const timer = useRef<number | undefined>()
  const setCurrent = (value: Call | null) => { callRef.current = value; setCall(value) }
  const changePhase = (phase: Call['phase']) => { if (callRef.current) setCurrent({ ...callRef.current, phase }) }
  const cleanup = () => {
    generation.current++; window.clearTimeout(timer.current)
    pc.current?.close(); pc.current = null
    local.current?.getTracks().forEach(track => track.stop()); local.current = null
    remote.current?.getTracks().forEach(track => track.stop()); remote.current = null
    pendingIce.current = []; setMuted(false); setCameraOff(false); setCurrent(null)
  }
  const end = (action = 'hangup') => {
    const current = callRef.current
    if (current) api.sendCall({ action, callId: current.id })
    cleanup()
  }
  const fail = (message: string) => { end(); setError(message) }
  const createPeer = (current: Call) => {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pc.current = peer
    local.current?.getTracks().forEach(track => peer.addTrack(track, local.current!))
    peer.onicecandidate = event => { if (event.candidate) api.sendCall({ action: 'candidate', callId: current.id, data: event.candidate.toJSON() }) }
    peer.ontrack = event => {
      if (!remote.current) remote.current = new MediaStream()
      if (!remote.current.getTracks().some(track => track.id === event.track.id)) remote.current.addTrack(event.track)
      if (remoteVideo.current) { remoteVideo.current.srcObject = remote.current; void remoteVideo.current.play().catch(() => undefined) }
    }
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') { window.clearTimeout(timer.current); changePhase('connected') }
      if (peer.connectionState === 'failed') fail(t('call.failed'))
    }
    timer.current = window.setTimeout(() => { if (callRef.current?.id === current.id && peer.connectionState !== 'connected') fail(t('call.failed')) }, 45000)
    return peer
  }
  const media = async (kind: Kind) => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('insecure')
    return navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' })
  }
  const start = async (roomId: string, name: string, kind: Kind) => {
    setError('')
    if (api.mode !== 'server') { setError(t('call.serverOnly')); return }
    if (callRef.current) { setError(t('call.busy')); return }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError(t('call.https')); return }
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
    const current: Call = { id, roomId, kind, name, incoming: false, phase: 'ringing' }
    setCurrent(current); const gen = generation.current
    try {
      const stream = await media(kind)
      if (gen !== generation.current) { stream.getTracks().forEach(x => x.stop()); return }
      local.current = stream
      if (!api.sendCall({ action: 'invite', callId: id, roomId, kind })) { cleanup(); setError(t('call.offline')); return }
    } catch (e) { if (gen === generation.current) { cleanup(); setError(e instanceof Error && e.message === 'insecure' ? t('call.https') : t('call.permission')) } }
  }
  const accept = async () => {
    const current = callRef.current
    if (!current || current.phase !== 'incoming') return
    changePhase('connecting'); const gen = generation.current
    try {
      const stream = await media(current.kind)
      if (gen !== generation.current) { stream.getTracks().forEach(x => x.stop()); return }
      local.current = stream; if (localVideo.current) localVideo.current.srcObject = stream; createPeer(current)
      if (!api.sendCall({ action: 'accept', callId: current.id })) fail(t('call.offline'))
    } catch (e) { if (gen === generation.current) { end('decline'); setError(e instanceof Error && e.message === 'insecure' ? t('call.https') : t('call.permission')) } }
  }
  useEffect(() => {
    if (localVideo.current && local.current) localVideo.current.srcObject = local.current
    if (remoteVideo.current && remote.current) { remoteVideo.current.srcObject = remote.current; void remoteVideo.current.play().catch(() => undefined) }
  }, [call])
  useEffect(() => {
    if (!profile) return
    return api.subscribeCalls(signal => {
      const current = callRef.current
      if (signal.action === 'transport-lost' && current) { cleanup(); setError(t('call.offline')); return }
      if (signal.action === 'invite') {
        if (current) { api.sendCall({ action: 'decline', callId: signal.callId }); return }
        if (signal.roomId && signal.kind) setCurrent({ id: signal.callId, roomId: signal.roomId, kind: signal.kind, name: signal.name || 'NEXO', incoming: true, phase: 'incoming' })
        return
      }
      if (!current || current.id !== signal.callId) return
      if (['ended', 'declined', 'timeout', 'busy', 'unavailable', 'answered-elsewhere'].includes(signal.action)) {
        cleanup()
        if (signal.action === 'busy') setError(t('call.busy'))
        if (signal.action === 'unavailable' || signal.action === 'timeout') setError(t('call.unavailable'))
        return
      }
      void (async () => {
        try {
          if (signal.action === 'accept' && !current.incoming) {
            changePhase('connecting'); const peer = createPeer(current)
            const offer = await peer.createOffer(); await peer.setLocalDescription(offer)
            api.sendCall({ action: 'offer', callId: current.id, data: offer })
          } else if (signal.action === 'offer' && current.incoming && pc.current) {
            await pc.current.setRemoteDescription(signal.data as RTCSessionDescriptionInit)
            for (const ice of pendingIce.current.splice(0)) await pc.current.addIceCandidate(ice)
            const answer = await pc.current.createAnswer(); await pc.current.setLocalDescription(answer)
            api.sendCall({ action: 'answer', callId: current.id, data: answer })
          } else if (signal.action === 'answer' && pc.current) {
            await pc.current.setRemoteDescription(signal.data as RTCSessionDescriptionInit)
            for (const ice of pendingIce.current.splice(0)) await pc.current.addIceCandidate(ice)
          } else if (signal.action === 'candidate') {
            if (pc.current?.remoteDescription) await pc.current.addIceCandidate(signal.data as RTCIceCandidateInit)
            else pendingIce.current.push(signal.data as RTCIceCandidateInit)
          }
        } catch { if (callRef.current?.id === current.id) fail(t('call.failed')) }
      })()
    })
  }, [profile?.id, t])
  useEffect(() => () => { if (callRef.current) end() }, [profile?.id])
  return <Context.Provider value={{ start: (room, name, kind) => { void start(room, name, kind) } }}>
    {children}
    {error && <div className="call-error" role="alert"><span>{error}</span><button className="btn btn-sm" onClick={() => setError('')}>{t('call.close')}</button></div>}
    {call && <div className="call-overlay" role="dialog" aria-modal="true" aria-label={t('call.title')}>
      <div className="call-panel glass">
        <div className="call-heading">NEXO · {call.kind === 'video' ? t('call.video') : t('call.audio')}</div>
        <h2>{call.name}</h2>
        <p>{call.phase === 'incoming' ? t('call.incoming') : call.phase === 'ringing' ? t('call.ringing') : call.phase === 'connecting' ? t('call.connecting') : t('call.connected')}</p>
        <div className={`call-videos ${call.kind === 'audio' ? 'audio-only' : ''}`}>
          <video ref={remoteVideo} autoPlay playsInline />
          {call.kind === 'video' && <video ref={localVideo} autoPlay playsInline muted className="call-self" />}
        </div>
        <div className="call-controls">
          {call.phase === 'incoming' ? <button className="btn call-accept" onClick={() => void accept()}>{t('call.accept')}</button> : <>
            <button className="btn" onClick={() => { const track = local.current?.getAudioTracks()[0]; if (track) { track.enabled = !track.enabled; setMuted(!track.enabled) } }}>{muted ? t('call.unmute') : t('call.mute')}</button>
            {call.kind === 'video' && <button className="btn" onClick={() => { const track = local.current?.getVideoTracks()[0]; if (track) { track.enabled = !track.enabled; setCameraOff(!track.enabled) } }}>{cameraOff ? t('call.cameraOn') : t('call.cameraOff')}</button>}
          </>}
          <button className="btn call-end" onClick={() => end(call.incoming && !pc.current ? 'decline' : 'hangup')}>{call.phase === 'incoming' ? t('call.decline') : t('call.end')}</button>
        </div>
      </div>
    </div>}
  </Context.Provider>
}

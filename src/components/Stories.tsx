import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { Avatar } from './ui'

const words = {
  en: { title:'Stories', add:'Add story', hint:'Visible for 24 hours to people you have sent a message to in a private chat.', caption:'Add a caption (optional)', publish:'Publish', cancel:'Cancel', close:'Close', previous:'Previous', next:'Next', remove:'Delete', confirm:'Delete this story?', error:'Could not load or publish the story. Try again.', mediaError:'Use a JPEG, PNG, WebP, MP4 or WebM up to 15 MB. Videos must be no longer than 60 seconds.', limit:'Up to 5 active stories.', uploading:'Publishing…' },
  ru: { title:'Истории', add:'Добавить', hint:'Историю увидят пользователи, которым вы писали в личном чате. Она исчезнет через 24 часа.', caption:'Подпись (необязательно)', publish:'Опубликовать', cancel:'Отмена', close:'Закрыть', previous:'Назад', next:'Далее', remove:'Удалить', confirm:'Удалить эту историю?', error:'Не удалось загрузить или опубликовать историю. Попробуйте ещё раз.', mediaError:'Выберите JPEG, PNG, WebP, MP4 или WebM до 15 МБ. Видео — не длиннее 60 секунд.', limit:'Не больше 5 активных историй.', uploading:'Публикуем…' },
  uk: { title:'Історії', add:'Додати', hint:'Історію побачать користувачі, яким ви писали в особистому чаті. Вона зникне через 24 години.', caption:'Підпис (необов’язково)', publish:'Опублікувати', cancel:'Скасувати', close:'Закрити', previous:'Назад', next:'Далі', remove:'Видалити', confirm:'Видалити цю історію?', error:'Не вдалося завантажити або опублікувати історію. Спробуйте ще раз.', mediaError:'Виберіть JPEG, PNG, WebP, MP4 або WebM до 15 МБ. Відео — не довше 60 секунд.', limit:'Не більше 5 активних історій.', uploading:'Публікуємо…' },
  'zh-CN': { title:'动态', add:'添加动态', hint:'向你在私聊中发过消息的用户显示，24小时后消失。', caption:'添加说明（可选）', publish:'发布', cancel:'取消', close:'关闭', previous:'上一个', next:'下一个', remove:'删除', confirm:'删除这条动态？', error:'无法加载或发布动态，请重试。', mediaError:'请选择不超过15 MB的 JPEG、PNG、WebP、MP4 或 WebM；视频不超过60秒。', limit:'最多保留5条有效动态。', uploading:'正在发布…' },
} as const

async function validVideo(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file)
  try { return await new Promise(resolve => {
    const video = document.createElement('video'); video.preload = 'metadata'
    const timer = window.setTimeout(() => resolve(false), 10000)
    video.onloadedmetadata = () => { clearTimeout(timer); resolve(Number.isFinite(video.duration) && video.duration > 0 && video.duration <= 60) }
    video.onerror = () => { clearTimeout(timer); resolve(false) }
    video.src = url
  }) } finally { URL.revokeObjectURL(url) }
}

export default function Stories() {
  const { profile } = useAuth(), { locale } = useI18n(), w = words[locale]
  const [stories,setStories] = useState<api.Story[]>([]), [selected,setSelected] = useState<string | null>(null)
  const [media,setMedia] = useState<string | null>(null), [file,setFile] = useState<File | null>(null)
  const [caption,setCaption] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (api.mode !== 'server' || !profile) return
    let alive = true, running = false, again = false
    const load = async () => { if (running) { again = true; return } running = true; do { again = false; try { const items = await api.listStories(); if (alive) setStories(items) } catch { if (alive) setError(w.error) } } while (alive && again); running = false }
    void load(); const unsub = api.subscribeGlobal(() => void load())
    const timer = window.setInterval(() => void load(), 60000)
    return () => { alive = false; unsub(); clearInterval(timer) }
  }, [profile?.id, locale])
  useEffect(() => {
    if (!selected) return
    const controller = new AbortController(); let url: string | undefined
    setMedia(null); setError('')
    api.storyMedia(selected, controller.signal).then(blob => { if (!controller.signal.aborted) { url = URL.createObjectURL(blob); setMedia(url) } }).catch(() => { if (!controller.signal.aborted) setError(w.error) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [selected, locale])
  const active = stories.find(s => s.id === selected), index = stories.findIndex(s => s.id === selected)
  useEffect(() => { if (selected && !active) setSelected(null) }, [selected, active])
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelected(null); setFile(null) } }; window.addEventListener('keydown',onKey); return () => window.removeEventListener('keydown',onKey) }, [])
  if (api.mode !== 'server' || !profile) return null
  const choose = async (f?: File) => {
    if (!f) return
    setError('')
    if (f.size > 15*1024*1024 || !['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(f.type) || (f.type.startsWith('video/') && !(await validVideo(f)))) { setError(w.mediaError); return }
    setFile(f)
  }
  const publish = async () => { if (!file || busy) return; setBusy(true); try { await api.createStory(file,caption); setStories(await api.listStories()); setFile(null); setCaption(''); setError('') } catch { setError(w.error) } finally { setBusy(false) } }
  const remove = async () => { if (!active || !window.confirm(w.confirm)) return; try { await api.deleteStory(active.id); setSelected(null); setStories(await api.listStories()) } catch { setError(w.error) } }
  return <section className="stories" aria-label={w.title}>
    <h2>{w.title}</h2><div className="stories-strip">
      <button className="story-person" onClick={() => input.current?.click()}><span className="story-add">+</span><span>{w.add}</span></button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden onChange={e => { void choose(e.target.files?.[0]); e.target.value = '' }} />
      {stories.map(s => <button key={s.id} className="story-person" onClick={() => setSelected(s.id)}><span className="story-ring"><Avatar profile={s.author} size={48} /></span><span>{s.author.id === profile.id ? w.title : s.author.display_name}</span></button>)}
    </div>
    {error && <p className="story-error" role="alert">{error}</p>}
    {file && <div className="story-overlay" role="dialog" aria-modal="true" aria-label={w.add}><div className="story-compose"><h2>{w.add}</h2><p>{w.hint}</p><p>{w.limit}</p><p className="story-filename">{file.name}</p><textarea className="input" maxLength={300} value={caption} onChange={e=>setCaption(e.target.value)} placeholder={w.caption} /><div className="story-actions"><button className="btn" disabled={busy} onClick={()=>setFile(null)}>{w.cancel}</button><button className="btn btn-primary" disabled={busy} onClick={()=>void publish()}>{busy ? w.uploading : w.publish}</button></div>{error && <p className="story-error">{error}</p>}</div></div>}
    {active && <div className="story-overlay" role="dialog" aria-modal="true" aria-label={w.title}><div className="story-viewer"><div className="story-top"><Avatar profile={active.author} size={38}/><strong>{active.author.display_name}</strong><button className="story-control" onClick={()=>setSelected(null)} aria-label={w.close}>×</button></div><div className="story-media">{!media && error && <p className="story-error" role="alert">{error}</p>}{media && (active.type.startsWith('video/') ? <video src={media} controls autoPlay playsInline /> : <img src={media} alt="" />)}</div>{active.caption && <p className="story-caption">{active.caption}</p>}<div className="story-actions"><button className="btn" disabled={index <= 0} onClick={()=>setSelected(stories[index-1].id)}>{w.previous}</button>{active.author.id === profile.id && <button className="btn" onClick={()=>void remove()}>{w.remove}</button>}<button className="btn" disabled={index >= stories.length-1} onClick={()=>setSelected(stories[index+1].id)}>{w.next}</button></div></div></div>}
  </section>
}

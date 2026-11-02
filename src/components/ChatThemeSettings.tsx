import type { CSSProperties } from 'react'
import { useI18n } from '../i18n'
import { CHAT_THEMES, themeName, themeStyle, type ChatTheme, type ChatThemeConfig } from '../lib/chatThemes'
import { IconBack, IconClock } from './icons'

export function ChatThemeParticles({ theme }: { theme: ChatThemeConfig }) {
  return <div className={`chat-theme-particles effect-${theme.effect}`} aria-hidden="true">
    {Array.from({ length: 14 }, (_, i) => <span key={i} style={{ '--x': `${(i * 37 + 7) % 97}%`, '--delay': `${-(i * 1.13)}s`, '--duration': `${7 + (i % 5) * 1.5}s`, '--size': `${7 + (i % 3) * 3}px` } as CSSProperties}>{theme.icon}</span>)}
  </div>
}

export default function ChatThemeSettings({ selected, busy, error, onChoose, onClose, onOpenScheduled }: { selected: ChatThemeConfig, busy: boolean, error: string, onChoose: (theme: ChatTheme) => void, onClose: () => void, onOpenScheduled: () => void }) {
  const { t, locale } = useI18n()
  return <section className="chat-theme-settings" aria-label={t('chatThemes.settings')}>
    <header className="chat-theme-settings-head">
      <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.back')}><IconBack size={20} /></button>
      <h2>{t('chatThemes.settings')}</h2>
    </header>
    <div className="chat-theme-settings-scroll">
      <button type="button" className="btn chat-settings-scheduled" onClick={onOpenScheduled}><IconClock size={19} /> {t('scheduled.list')}</button>
      <div className="chat-theme-panel">
        <h3>{t('chatThemes.choose')}</h3>
        <p>{t('chatThemes.private')}</p>
        {error && <div className="error-box" role="alert">{error}</div>}
        <div className="chat-theme-grid">
          {CHAT_THEMES.map(item => <button type="button" key={item.id} className={`chat-theme-card ${item.id === selected.id ? 'selected' : ''}`} style={themeStyle(item)} aria-label={themeName(item, locale)} aria-pressed={item.id === selected.id} disabled={busy} onClick={() => onChoose(item.id)}>
            <span className="chat-theme-card-pattern" aria-hidden="true">{item.icon}　{item.icon}<br />　{item.icon}　{item.icon}<br />{item.icon}　{item.icon}<br />　{item.icon}　{item.icon}</span>
            <span className="chat-theme-mini-bubble outgoing" /><span className="chat-theme-mini-bubble incoming" />
            <span className="chat-theme-card-icon" aria-hidden="true">{item.icon}</span>
            <span className="chat-theme-card-name">{themeName(item, locale)}</span>
          </button>)}
        </div>
      </div>
      <h3 className="chat-theme-preview-title">{t('chatThemes.preview')}</h3>
      <div className="chat-theme-preview" style={themeStyle(selected)}>
        <ChatThemeParticles theme={selected} />
        <div className="chat-theme-preview-bubble incoming">{t('chatThemes.exampleIn')}</div>
        <div className="chat-theme-preview-bubble outgoing">{t('chatThemes.exampleOut')}</div>
      </div>
    </div>
  </section>
}

import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { LOCALES } from '../i18n/translations'
import DigitalCodeStrip from '../components/DigitalCodeStrip'

export default function WelcomePage() {
  const { locale, setLocale, t } = useI18n()
  const navigate = useNavigate()

  return (
    <div className="welcome-wrap">
      <div className="welcome-glow welcome-glow-a" aria-hidden="true" />
      <div className="welcome-glow welcome-glow-b" aria-hidden="true" />

      <main className="welcome-card glass card">
        <div className="welcome-logo" aria-hidden="true">N</div>
        <div className="welcome-brand">NEXO</div>
        <div className="welcome-brand-sub">MESSENGER</div>
        <h1 className="welcome-tagline">{t('welcome.tagline')}</h1>
        <p className="welcome-sub">{t('welcome.subtitle')}</p>

        <div className="welcome-features">
          <span className="pill pill-violet">💬 {t('welcome.feature.chats')}</span>
          <span className="pill pill-violet">👥 {t('welcome.feature.groups')}</span>
          <span className="pill pill-violet">🔒 {t('welcome.feature.secure')}</span>
        </div>

        <div className="section-label" style={{ textAlign: 'left', marginTop: 26 }}>{t('welcome.chooseLanguage')}</div>
        <div className="lang-grid" role="radiogroup" aria-label={t('welcome.chooseLanguage')}>
          {LOCALES.map((l) => (
            <button key={l.code} role="radio" aria-checked={locale === l.code}
              aria-label={`${l.flag} ${l.native} (${l.english})`}
              className={`lang-option glass ${locale === l.code ? 'active' : ''}`}
              onClick={() => setLocale(l.code)}>
              <span className="lang-flag" aria-hidden="true">{l.flag}</span>
              <span className="lang-names">
                <span className="lang-native">{l.native}</span>
                <span className="lang-english">{l.english}</span>
              </span>
              {locale === l.code && <span className="lang-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>

        <button className="btn start-btn" onClick={() => navigate('/login')}>
          {t('welcome.start')} <span aria-hidden="true">→</span>
        </button>
      </main>

      <DigitalCodeStrip />
    </div>
  )
}

import { useI18n } from '../i18n'

/** Keep the entry visible even when closed, so the owner can discover the setting. */
export function ChannelCommentsButton({ enabled, count, onOpen }: { enabled: boolean; count: number; onOpen: () => void }) {
  const { t } = useI18n()
  return <button type="button" className="btn btn-sm channel-comments-open" onClick={onOpen}>
    {t('channelComments.title')} · {count}{!enabled && ` · ${t('channelComments.disabled')}`}
  </button>
}

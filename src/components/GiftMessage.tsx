import { useState } from 'react'
import type { Message } from '../lib/types'
import { useI18n } from '../i18n'
import { giftArt } from '../lib/giftCatalog'
import { IconGift } from './icons'
import { Modal } from './ui'

/** A delivery notice is a record of a transfer, not a new gift transaction. */
export function GiftMessage({ message, sender }: { message: Message; sender: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const data = message.gift_data
  const senderName = data?.anonymous ? t('delivery.giftAnonymousName') : data?.sender_name || sender || t('delivery.giftUnknownSender')
  if (message.attachment_type === 'gift/nft-transfer') {
    return <div className="gift-delivery-event" role="note">{t('delivery.giftNftNotice', { sender })} <strong>{message.attachment_name}{data?.serial ? ` #${data.serial}` : ''}</strong></div>
  }
  const art = giftArt(message.attachment_url)
  return <div className="gift-delivery">
    <div className="gift-delivery-event">{data?.price != null ? t('delivery.giftSentNotice', { sender: senderName, amount: String(data.price) }) : t('delivery.giftFrom', { sender: senderName })}</div>
    <div className="gift-delivery-card">
      {art ? <img src={art} alt={message.attachment_name} /> : <span className="gift-delivery-fallback"><IconGift size={70} /></span>}
      <strong>{data?.anonymous ? t('delivery.giftFromAnonymous') : t('delivery.giftFrom', { sender: senderName })}</strong>
      {data?.comment && <p>{data.comment}</p>}
      <button type="button" className="gift-delivery-button" onClick={() => setOpen(true)}>{t('delivery.giftView')}</button>
    </div>
    {open && <Modal title={message.attachment_name} onClose={() => setOpen(false)}>
      <div className="gift-detail-art">{art ? <img src={art} alt={message.attachment_name} /> : <IconGift size={80} />}</div>
      <div className="gift-detail-name">{message.attachment_name}</div>
      <div className="kv-list">
        <div className="kv-row"><span>{t('delivery.giftSender')}</span><strong>{senderName}</strong></div>
        <div className="kv-row"><span>{t('delivery.giftCommentLabel')}</span><strong className="gift-comment-value">{data?.comment || t('delivery.giftNoComment')}</strong></div>
      </div>
    </Modal>}
  </div>
}

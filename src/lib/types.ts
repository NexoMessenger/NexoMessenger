export type ID = string

export interface BusinessHoursDay {
  /** 0 = Monday … 6 = Sunday */
  day: number
  enabled: boolean
  /** "09:00" */
  open: string
  /** "18:00" */
  close: string
}

export interface BusinessInfo {
  enabled: boolean
  name: string
  address: string
  hours: BusinessHoursDay[]
}

/** Snapshot of the collectible a Premium user "wears" next to their name. */
export interface WornGift {
  item_id: string
  model_key: string
  serial: number
}

export interface Profile {
  id: ID
  username: string
  display_name: string
  avatar_url: string
  bio: string
  is_online: boolean
  last_seen: string
  created_at: string
  /* ------- NEXO Premium decorations (public, shown next to the name) ------- */
  /** ISO time until which Premium is active; empty/null = no Premium. */
  premium_until?: string | null
  /** One animated emoji shown next to the nickname. */
  emoji_status?: string
  worn_gift?: WornGift | null
  /** Key of the name colour palette (see premiumData NAME_COLORS). */
  name_color?: string
  business?: BusinessInfo | null
  /** Collectibles pinned to the profile background (frameless, floating). */
  bg_gifts?: BgGift[]
  /** Music card shown in the profile. */
  profile_music?: ProfileMusic | null
  /** Display-name font style key (see premiumData PROFILE_FONTS). */
  profile_font?: string
  /** Profile page theme key (see premiumData PROFILE_THEMES). */
  profile_theme?: string
}

/** Snapshot of a collectible pinned to the profile background. */
export interface BgGift {
  item_id: string
  model_key: string
  serial: number
}

export interface ProfileMusic {
  title: string
  artist: string
  url: string
}

export interface PremiumState {
  active: boolean
  until: string | null
  priceRub: number
  days: number
}

export interface Conversation {
  id: ID
  created_by: ID | null
  created_at: string
  last_message_at: string
}

export interface ConvMember {
  conversation_id: ID
  user_id: ID
  last_read_at: string
  joined_at: string
}

export interface RegularGiftInfo { id: ID; sender_name: string; anonymous: boolean; comment: string }

export interface Message {
  id: ID
  conversation_id: ID
  sender_id: ID
  body: string
  attachment_url: string
  attachment_name: string
  attachment_type: string
  attachment_duration?: number
  gift_data?: (Partial<RegularGiftInfo> & { price?: number; fee?: number; serial?: number })
  /** Id of the message this one replies to (quote), when set. */
  reply_to?: string
  /** ISO timestamp of the last edit (sender-only), when edited. */
  edited_at?: string
  created_at: string
}

export type ReactionScope = 'direct' | 'group'

export interface Reaction {
  id: string
  scope: ReactionScope
  conversation_id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface Group {
  id: ID
  name: string
  avatar_url: string
  description: string
  owner_id: ID
  is_public: boolean
  created_at: string
  last_message_at: string
}

export interface GroupMember {
  group_id: ID
  user_id: ID
  role: 'owner' | 'admin' | 'member'
  last_read_at: string
  joined_at: string
}

export interface GroupMessage extends Omit<Message, 'conversation_id'> {
  group_id: ID
}

export interface Channel {
  id: ID
  name: string
  avatar_url: string
  description: string
  owner_id: ID
  is_public: boolean
  created_at: string
}

export interface ChannelMember {
  channel_id: ID
  user_id: ID
  role: 'owner' | 'admin' | 'subscriber'
  can_post: boolean
  joined_at: string
}

export interface ChannelPost {
  id: ID
  channel_id: ID
  author_id: ID
  body: string
  attachment_url: string
  attachment_name: string
  attachment_type: string
  created_at: string
}

export interface UserSettings {
  user_id: ID
  theme: 'nexoglass' | 'midnight' | 'graphite' | 'lime' | 'light' | 'coffee' | 'sakura' | 'ocean' | 'sunset'
  notifications_enabled: boolean
  privacy_profile: 'public' | 'private'
  language?: string
  updated_at: string
}

export interface AttachmentInfo {
  url: string
  name: string
  type: string
  duration?: number
}

export type Unsubscribe = () => void

/* ============================== NEXO Gifts ============================== */

export interface GiftModel {
  key: string
  kind: 'collectible' | 'regular'
  collection: string
  name: string
  pattern: string
  background: string
  /** In-app rarity attributes defined by the NEXO catalog (percent of supply). */
  rarity_model: number
  rarity_pattern: number
  rarity_background: number
  total_supply: number
  /** Store (floor) price in NEX for collectibles; purchase price for regular gifts. */
  floor_price: number
  /** Instances minted so far (provided by the backend; absent in static catalog). */
  issued?: number
}

export interface GiftItem {
  id: ID
  serial: number
  model_key: string
  /** null = owned by the NEXO Store (primary stock). */
  owner_id: ID | null
}

export interface GiftListing {
  id: ID
  item_id: ID
  seller_id: ID
  price: number
  created_at: string
}

/** One marketplace card: a store item (listing null) or a user listing. */
export interface MarketEntry {
  item: GiftItem
  model: GiftModel
  listing: GiftListing | null
  seller: Profile | null
  price: number
}

export interface OwnedGift {
  item: GiftItem
  model: GiftModel
  listing: GiftListing | null
}

/** A publication on a user profile: photo/video and/or text, archivable. */
export interface ProfilePost {
  id: ID
  user_id: ID
  body: string
  attachment_url: string
  attachment_name: string
  attachment_type: string
  archived: boolean
  created_at: string
}

/** A user's public gift showcase: collectible NFTs + regular gift stock. */
export interface UserGifts {
  items: OwnedGift[]
  regular: { model: GiftModel; qty: number; gift?: RegularGiftInfo }[]
}

export interface GiftTxn {
  id: ID
  kind: 'welcome' | 'bonus' | 'purchase' | 'sale' | 'regular_buy' | 'regular_send' | 'regular_sell' | 'transfer' | 'promo'
  amount: number
  note: string
  created_at: string
}

export interface GiftState {
  balance: number
  /** ISO time when the next daily bonus can be claimed; null = ready now. */
  nextBonusAt: string | null
  bonusAmount: number
  myItems: OwnedGift[]
  myRegular: { model: GiftModel; qty: number }[]
  transactions: GiftTxn[]
}

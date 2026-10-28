export type ID = string

export interface Profile {
  id: ID
  username: string
  display_name: string
  avatar_url: string
  bio: string
  is_online: boolean
  last_seen: string
  created_at: string
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

export interface Message {
  id: ID
  conversation_id: ID
  sender_id: ID
  body: string
  attachment_url: string
  attachment_name: string
  attachment_type: string
  attachment_duration?: number
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
  theme: 'nexoglass' | 'midnight' | 'graphite'
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

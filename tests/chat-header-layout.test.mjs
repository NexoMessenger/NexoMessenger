import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('direct chat header keeps names on one line and scheduled messages remain accessible in chat settings', async () => {
  const page = await readFile('src/pages/ChatRoomPage.tsx', 'utf8')
  const settings = await readFile('src/components/ChatThemeSettings.tsx', 'utf8')
  const css = await readFile('src/index.css', 'utf8')
  assert.match(page, /onOpenScheduled=\{\(\) => \{ setThemeOpen\(false\); setScheduledOpen\(true\) \}\}/)
  assert.match(settings, /onClick=\{onOpenScheduled\}/)
  assert.match(css, /\.direct-chat-room \.room-head-profile \.row-title \{[^}]*flex-wrap: nowrap;[^}]*white-space: nowrap/)
  assert.match(css, /\.direct-chat-room \.room-head-profile \.profile-name > :first-child \{[^}]*text-overflow: ellipsis/)
})

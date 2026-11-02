import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readFile, stat } from 'node:fs/promises'

test('backgrounds have selectable assets, silent video and accessible decorative content', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { PROFILE_BACKGROUNDS, isProfileBackground } = await vite.ssrLoadModule('/src/lib/profileBackgrounds.ts')
    const { ProfileBackground } = await vite.ssrLoadModule('/src/components/ProfileBackground.tsx')
    const { dictionaries } = await vite.ssrLoadModule('/src/i18n/translations.ts')
    assert.equal(PROFILE_BACKGROUNDS.length, 15)
    assert.equal(PROFILE_BACKGROUNDS.filter(item => item.premium).length, 11)
    for (const item of PROFILE_BACKGROUNDS) {
      assert.equal(isProfileBackground(item.id), true)
      assert.ok((await stat(`public${item.poster}`)).size > 0)
      if (item.video) assert.ok((await stat(`public${item.video}`)).size > 0)
      for (const lang of ['en', 'ru', 'uk', 'zh-CN']) assert.ok(dictionaries[lang][item.label])
      const html = renderToStaticMarkup(React.createElement(ProfileBackground, { value: item.id, premiumActive: true }))
      assert.match(html, /aria-hidden="true"/)
      if (item.video) { assert.match(html, /muted=""/); assert.match(html, /playsinline=""/); assert.match(html, /loop=""/) }
      else if (item.id === 'storm_field') assert.match(html, /profile-lightning-bolt/)
      else assert.equal((html.match(/<span/g) || []).length, 12)
      if (item.premium) assert.equal(renderToStaticMarkup(React.createElement(ProfileBackground, { value: item.id, premiumActive: false })), '')
    }
    assert.equal(renderToStaticMarkup(React.createElement(ProfileBackground, { value: '' })), '')
    assert.equal(isProfileBackground('http://invalid.example'), false)
    const css = await readFile('src/index.css', 'utf8')
    assert.match(css, /prefers-reduced-motion: reduce\) \{ \.profile-backdrop video/)
  } finally { await vite.close() }
})


test('background settings are in Premium only while the profile still displays its background', async () => {
  const profile = await readFile('src/pages/ProfilePage.tsx', 'utf8')
  const premium = await readFile('src/pages/PremiumPage.tsx', 'utf8')
  assert.doesNotMatch(profile, /ProfileBackgroundSettings/)
  assert.match(profile, /<ProfileBackground value=\{profile\.profile_background\}/)
  assert.match(premium, /<ProfileBackgroundSettings preview\s*\/>/)
})

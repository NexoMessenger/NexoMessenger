import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('all 15 creative badges render the actual name and have translated labels', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { CREATIVE_BADGES, isCreativeBadge, isNameBadge } = await vite.ssrLoadModule('/src/lib/nameBadges.ts')
    const { CreativeName } = await vite.ssrLoadModule('/src/components/CreativeName.tsx')
    const { dictionaries } = await vite.ssrLoadModule('/src/i18n/translations.ts')
    assert.equal(CREATIVE_BADGES.length, 15)
    assert.equal(new Set(CREATIVE_BADGES.map(b => b.id)).size, 15)
    for (const badge of CREATIVE_BADGES) {
      assert.equal(isCreativeBadge(badge.id), true)
      assert.equal(isNameBadge(badge.id), true)
      const html = renderToStaticMarkup(React.createElement(CreativeName, { name: 'Имя пользователя', kind: badge.id }))
      assert.match(html, /Имя пользователя/)
      assert.match(html, /aria-hidden="true"/)
      assert.equal((html.match(/<svg/g) || []).length, 6)
      for (const locale of ['en', 'ru', 'uk', 'zh-CN']) assert.ok(dictionaries[locale][`premium.badge.${badge.id}`])
    }
    assert.equal(isNameBadge('not-a-badge'), false)
  } finally { await vite.close() }
})

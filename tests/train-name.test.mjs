import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('train badge has eight separate cars, two cabs and animated wind', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { TrainName } = await vite.ssrLoadModule('/src/components/TrainName.tsx')
    const html = renderToStaticMarkup(React.createElement(TrainName, { name: 'Имя' }))
    assert.match(html, /Имя/)
    assert.match(html, /aria-hidden="true"/)
    assert.equal((html.match(/class="train-car train-passenger"/g) || []).length, 8)
    assert.equal((html.match(/class="train-cab"/g) || []).length, 2)
    assert.match(html, /scale\(-1 1\)/)
    assert.equal((html.match(/assets\/express-carriage\.png/g) || []).length, 8)
    assert.match(html, /train-wind-one/)
    assert.match(html, /train-wind-two/)
    const css = await readFile('src/index.css', 'utf8')
    assert.match(css, /animation: train-name-pass 3s/)
    assert.match(css, /animation: train-wind/)
    assert.match(css, /prefers-reduced-motion: reduce\) \{ \.train-name-train/)
  } finally { await vite.close() }
})

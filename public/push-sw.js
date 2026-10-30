self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* malformed push */ }
  event.waitUntil(self.registration.showNotification(data.title || 'NEXO', {
    body: data.body || 'New message',
    icon: new URL('push-icon.png', self.registration.scope).href,
    badge: new URL('push-badge.png', self.registration.scope).href,
    tag: 'nexo-' + (data.path || 'message'), renotify: true,
    data: { path: data.path || '/chats' }
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const path = /^\/(chat|group)\/[a-zA-Z0-9%_-]+$/.test(event.notification.data?.path || '') ? event.notification.data.path : '/chats'
  const target = new URL(self.registration.scope); target.hash = path
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const client = clients.find(c => new URL(c.url).origin === target.origin)
    if (client) { await client.navigate(target.href); return client.focus() }
    return self.clients.openWindow(target.href)
  })())
})

/// <reference types="bun" />
import { networkInterfaces } from 'node:os'

let seq = 0
let current = ''
let count = 0

function next() {
  seq += 1
  current = `${seq}:${Math.random().toString(36).slice(2, 8)}`
}
next()

const state = () => JSON.stringify({ value: current, count })

const PAGE = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>QR throughput</title>
<style>
  body { margin: 0; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; font: 16px system-ui; }
  #meta { margin-top: 12px; color: #666; }
</style>
<div id="qr"></div>
<div id="meta"></div>
<button id="pip">Pop out (always on top)</button>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>
<script>
  let box = document.getElementById('qr'), meta = document.getElementById('meta')
  let size = Math.min(innerWidth, innerHeight) * 0.5
  let last = null
  function render(state) {
    last = state
    const qr = qrcode(0, 'L')
    qr.addData(state.value)
    qr.make()
    box.innerHTML = qr.createSvgTag({ cellSize: Math.floor(size / (qr.getModuleCount() + 4)), margin: 2 })
  }
  document.getElementById('pip').onclick = async () => {
    const pip = await documentPictureInPicture.requestWindow({ width: 360, height: 360 })
    pip.document.body.style.cssText = 'margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#fff'
    box = pip.document.createElement('div')
    pip.document.body.append(box)
    size = 320
    if (last) render(last)
  }
  function connect() {
    const ws = new WebSocket('ws://' + location.host + '/ws')
    ws.onmessage = (e) => render(JSON.parse(e.data))
    ws.onclose = () => setTimeout(connect, 500)
  }
  connect()
</script>`

const server = Bun.serve({
  port: 3000,
  async fetch(req, server) {
    const { pathname } = new URL(req.url)
    if (pathname === '/ws') {
      return server.upgrade(req)
        ? undefined
        : new Response('upgrade failed', { status: 400 })
    }
    if (pathname === '/scan' && req.method === 'POST') {
      const { value } = (await req.json()) as { value?: string }
      const ok = value === current
      if (ok) {
        count += 1
        next()
        server.publish('qr', state())
      }
      return Response.json({ ok })
    }
    if (pathname === '/status') {
      return Response.json({ value: current, count })
    }
    if (pathname === '/reset' && req.method === 'POST') {
      count = 0
      next()
      server.publish('qr', state())
      return Response.json({ ok: true })
    }
    return new Response(PAGE, { headers: { 'content-type': 'text/html' } })
  },
  websocket: {
    open(ws) {
      ws.subscribe('qr')
      ws.send(state())
    },
    message() {},
  },
})

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i?.family === 'IPv4' && !i.internal)
  .map((i) => `http://${i?.address}:${server.port}`)
console.log(
  `QR server on http://localhost:${server.port}  LAN: ${lan.join(' ')}`,
)

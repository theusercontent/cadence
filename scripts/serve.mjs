import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const port = Number(process.env.PORT || 4173)
const host = process.env.HOST || '127.0.0.1'

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
])

async function safeFile(requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0])
  const normalized = path.normalize(decoded).replace(/^(\.\.[\\/])+/, '')
  const target = path.join(root, normalized)
  if (!target.startsWith(root)) return null
  try {
    await access(target)
    return target
  } catch {
    return null
  }
}

const server = createServer(async (request, response) => {
  const url = request.url || '/'
  let file = await safeFile(url)

  if (file) {
    const info = await stat(file)
    if (info.isDirectory()) file = path.join(file, 'index.html')
  }

  if (!file) {
    file = path.join(root, 'index.html')
  }

  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error('Not a file')
    const extension = path.extname(file).toLowerCase()
    response.writeHead(200, {
      'Content-Type': MIME.get(extension) || 'application/octet-stream',
      'Cache-Control':
        file.endsWith('index.html') || file.endsWith('sw.js')
          ? 'no-cache, no-store, must-revalidate'
          : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    })
    createReadStream(file).pipe(response)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

server.listen(port, host, () => {
  console.log(`Cadence is serving on http://${host}:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}

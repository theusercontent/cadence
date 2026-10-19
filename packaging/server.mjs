import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, 'app')
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 4173)
const appUrl = `http://${host}:${port}/`

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

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

async function safeFile(requestPath) {
  const decoded = safeDecode(requestPath.split('?')[0])
  if (decoded === null) return null
  const normalized = path.normalize(decoded).replace(/^(\.\.[\\/])+/, '')
  const target = path.join(root, normalized)
  const relative = path.relative(root, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
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
    const extension = path.extname(safeDecode(url.split('?')[0]) || '').toLowerCase()
    if (extension && extension !== '.html') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }
    file = path.join(root, 'index.html')
  }

  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error('Not a file')
    const extension = path.extname(file).toLowerCase()
    response.writeHead(200, {
      'Content-Type': MIME.get(extension) || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control':
        file.endsWith('index.html') || file.endsWith('sw.js')
          ? 'no-cache, no-store, must-revalidate'
          : 'public, max-age=31536000, immutable',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    createReadStream(file).pipe(response)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

function openBrowser(url) {
  if (process.env.CADENCE_OPEN !== '1') return
  try {
    if (process.platform === 'win32') {
      const child = spawn('rundll32', ['url.dll,FileProtocolHandler', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
      return
    }
    const command = process.platform === 'darwin' ? 'open' : 'xdg-open'
    const child = spawn(command, [url], { detached: true, stdio: 'ignore' })
    child.unref()
  } catch {
    // The user can still open the printed address manually.
  }
}

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`Cadence could not start because port ${port} is already in use.`)
    console.error(`Open ${appUrl} to use the existing server, or close the other app and try again.`)
    if (process.env.CADENCE_OPEN === '1') openBrowser(appUrl)
  } else {
    console.error(error)
  }
  process.exitCode = 1
})

server.listen(port, host, () => {
  console.log('')
  console.log('  Cadence is running locally.')
  console.log(`  Open: ${appUrl}`)
  console.log('')
  console.log('  Your data stays in this browser. Close this window to stop Cadence.')
  console.log('')
  setTimeout(() => openBrowser(appUrl), 350)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}

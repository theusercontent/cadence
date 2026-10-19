import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const outputDirectory = path.resolve(process.argv[2] || path.join(os.homedir(), 'Desktop'))
const zipPath = path.join(outputDirectory, `Cadence-Offline-v${version}-Windows.zip`)
const stagingRoot = path.join(os.tmpdir(), 'opencode', 'cadence-offline-package')
const packageRoot = path.join(stagingRoot, 'Cadence-Offline')
const appRoot = path.join(packageRoot, 'app')
const runtimeRoot = path.join(packageRoot, 'runtime')

function requireFile(file, label) {
  if (!existsSync(file)) throw new Error(`${label} is missing: ${file}`)
}

function copyWithCrlf(source, destination) {
  const text = readFileSync(source, 'utf8').replace(/\r?\n/g, '\r\n')
  writeFileSync(destination, text, 'utf8')
}

if (process.platform !== 'win32') {
  throw new Error('The offline package includes a Windows Node runtime and must be built on Windows.')
}
if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  throw new Error('Production build not found. Run npm run build first.')
}

requireFile(path.join(root, 'packaging', 'server.mjs'), 'Offline server')
requireFile(path.join(root, 'packaging', 'run.bat'), 'Run script')
requireFile(path.join(root, 'packaging', 'requirements.bat'), 'Requirements script')
requireFile(path.join(root, 'packaging', 'README.txt'), 'Offline README')
requireFile(path.join(root, 'packaging', 'NODE-LICENSE'), 'Node.js license')
requireFile(process.execPath, 'Node.js runtime')

rmSync(stagingRoot, { recursive: true, force: true })
mkdirSync(appRoot, { recursive: true })
mkdirSync(runtimeRoot, { recursive: true })
mkdirSync(outputDirectory, { recursive: true })

cpSync(path.join(root, 'dist'), appRoot, { recursive: true })
copyFileSync(path.join(root, 'packaging', 'server.mjs'), path.join(packageRoot, 'server.mjs'))
copyWithCrlf(path.join(root, 'packaging', 'run.bat'), path.join(packageRoot, 'run.bat'))
copyWithCrlf(
  path.join(root, 'packaging', 'requirements.bat'),
  path.join(packageRoot, 'requirements.bat'),
)
copyWithCrlf(path.join(root, 'packaging', 'README.txt'), path.join(packageRoot, 'README.txt'))
copyFileSync(process.execPath, path.join(runtimeRoot, 'node.exe'))
copyFileSync(path.join(root, 'packaging', 'NODE-LICENSE'), path.join(runtimeRoot, 'NODE-LICENSE'))

const psQuote = (value) => `'${value.replace(/'/g, "''")}'`
const script = `
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath ${psQuote(zipPath)}) { Remove-Item -LiteralPath ${psQuote(zipPath)} -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(${psQuote(packageRoot)}, ${psQuote(zipPath)}, [System.IO.Compression.CompressionLevel]::Optimal, $true)
`
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
  stdio: 'inherit',
})

const bytes = statSync(zipPath).size
console.log('')
console.log(`Cadence offline package created: ${zipPath}`)
console.log(`Size: ${(bytes / 1024 / 1024).toFixed(1)} MB`)
console.log(`Version: ${version}`)

# Cadence

A calm, offline-first task manager for focused teams. Cadence runs entirely in the browser: there is no backend, no analytics, and no server-side workspace. Tasks, projects, people, activity, and preferences stay in local storage on the device.

## Highlights

- **Local-first by design** — the complete workspace persists in the browser, with JSON backup/restore and a generated PWA service worker for offline use.
- **Persistent memory** — remembers the signed-in session, last route, last task, recent searches, sign-in history, theme, and workspace activity.
- **Role-based access** — enforced `admin`, `manager`, `employee`, and `viewer` permissions across tasks, projects, people, comments, and workspace data.
- **Focused workspace** — overview, list and board views, calendar, project pages, team directory, activity memory, command palette, and keyboard shortcuts.
- **Thoughtful interface** — light, dark, and system themes; responsive desktop and mobile layouts; reduced-motion support; installable app icons.
- **Hashed credentials** — local passwords use PBKDF2-SHA256 with 120,000 iterations through WebCrypto.

## Demo accounts

| Person | Role | Email | Password |
| --- | --- | --- | --- |
| Ava Chen | Admin | `ava@cadence.app` | `admin123` |
| Marcus Reed | Manager | `marcus@cadence.app` | `manager123` |
| Maya Patel | Employee | `maya@cadence.app` | `maya1234` |
| Noah Williams | Viewer | `noah@cadence.app` | `noah1234` |

The demo passwords are public by design. Use **Settings → Reset demo workspace** to restore the seed data at any time.

## Local development

```bash
npm install
npm run dev
```

The development server is available at `http://localhost:5173`.

## Production build

```bash
npm run build
npm start
```

`npm run build` type-checks the app, bundles the production assets, and generates `dist/sw.js` with a precache manifest. `npm start` serves the build with SPA fallback, long-lived asset caching, and no-store headers for the app shell and service worker.

Set `HOST` and `PORT` when needed:

```powershell
$env:HOST = '0.0.0.0'; $env:PORT = '8080'; npm start
```

## Verification

```bash
npm test
npm run build
```

The test suite covers password hashing, password policy, session storage, role visibility and write boundaries, workspace mutations, memory, imports/exports, and reset behavior.

A browser smoke suite is included for end-to-end verification. It requires Chrome and a production server:

```powershell
npm run build
npm run prod
# in a second terminal
node scripts/qa-smoke.mjs
```

The smoke suite exercises sign-in and session restore, task creation, search, completion, command palette memory, route restoration, PWA/offline behavior, board drag and drop, calendar navigation, projects, invitations, backup validation, reset, every role boundary, mobile navigation, and a clean seed restore. Screenshots and a report are written to `%TEMP%\opencode\cadence-qa`.

## Deployment

Cadence is a static single-page app. Cloudflare Pages is the recommended free host: unlimited static requests and bandwidth, free HTTPS, and no card required. The build includes a `_headers` file that preserves the local-only Content Security Policy and cache behavior.

1. Run `npm run build`.
2. In the Cloudflare dashboard, create a Pages project and upload the contents of `dist/`.
3. Use a unique project name; the free URL will be `https://<project-name>.pages.dev`.
4. Leave build settings empty for a direct upload, or connect the repository with build command `npm run build` and output directory `dist`.

Alternatively, deploy from the CLI after signing in to Cloudflare:

```bash
npx wrangler@latest pages deploy dist --project-name cadence-workspace
```

For any static host:

1. Publish `dist/`.
2. Rewrite unknown paths to `index.html`.
3. Serve over HTTPS so the service worker and PWA installation are enabled.
4. Copy the security headers from `public/_headers` into the host's header configuration.

Because routing is hash-based, deep links such as `/#/tasks` work without server rewrites, but the app shell itself still needs a fallback for non-root paths. Do not cache `sw.js` or `index.html` indefinitely; the generated service worker handles versioned app-shell caches. All data remains local to each browser, so there is no database or API to provision.

## Privacy and security notes

- The production server sends a restrictive Content Security Policy that only permits same-origin scripts, styles, connections, workers, and media capabilities, keeping the app local-only in practice as well as by design.
- The workspace is stored in the browser and is readable by anyone with access to that browser profile. Backups contain hashed credentials and should be kept private.
- Local accounts are suitable for a demo or an offline team utility, not as a replacement for central identity management.
- Clearing browser storage permanently deletes the workspace. Export a backup first.
- There is no password recovery beyond an admin resetting a local password from Team.

## Structure

```text
src/
  components/   shared shell, overlays, navigation, and UI primitives
  data/         seeded workspace and demo accounts
  lib/          auth, storage, permissions, dates, and utilities
  pages/        route screens
  store/        central workspace state and CRUD
  styles/       CSS partials imported by styles.css
  test/         Vitest coverage
scripts/
  build-sw.mjs  generated offline service worker
  serve.mjs     dependency-free production server
  qa-smoke.mjs  browser end-to-end suite
```

import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const BASE = 'http://127.0.0.1:4173/'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ARTIFACTS = 'C:\\Users\\akaka\\AppData\\Local\\Temp\\opencode\\cadence-qa'
const DOWNLOADS = path.join(ARTIFACTS, 'downloads')
const PROFILE = 'C:\\Users\\akaka\\AppData\\Local\\Temp\\opencode\\cadence-qa-profile'
const QA_TASK = 'QA · Admin smoke task'
const OFFLINE_TASK = 'QA · Offline task'

mkdirSync(ARTIFACTS, { recursive: true })
rmSync(PROFILE, { recursive: true, force: true })
mkdirSync(path.join(PROFILE, 'Default'), { recursive: true })
writeFileSync(
  path.join(PROFILE, 'Default', 'Preferences'),
  JSON.stringify({
    credentials_enable_service: false,
    profile: {
      password_manager_enabled: false,
      password_manager_leak_detection: false,
      exit_type: 'Normal',
    },
    autofill: { profile_enabled: false, credit_card_enabled: false },
  }),
)

const report = []
const consoleErrors = []
const pageErrors = []
const steps = []
let browser
let page
let currentStep = 'startup'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function note(message) {
  steps.push({ step: currentStep, message })
  console.log(`  ✓ ${message}`)
}

async function runStep(name, fn) {
  currentStep = name
  console.log(`\n▸ ${name}`)
  await fn()
}

async function clickText(selector, text) {
  const handle = await page.evaluateHandle(
    (sel, wanted) =>
      [...document.querySelectorAll(sel)].find((element) =>
        element.textContent.replace(/\s+/g, ' ').trim().includes(wanted),
      ) ?? null,
    selector,
    text,
  )
  const element = handle.asElement()
  if (!element) throw new Error(`Could not find ${selector} containing “${text}”`)
  await element.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await element.click()
}

async function waitForText(selector, text, timeout = 10000) {
  await page.waitForFunction(
    (sel, wanted) =>
      [...document.querySelectorAll(sel)].some((element) =>
        element.textContent.replace(/\s+/g, ' ').includes(wanted),
      ),
    { timeout },
    selector,
    text,
  )
}

async function waitHeading(label, timeout = 15000) {
  await page.waitForFunction(
    (wanted) => document.querySelector('h1')?.textContent.trim() === wanted,
    { timeout },
    label,
  )
}

async function waitPage(label) {
  if (label === 'Overview') {
    await page.waitForSelector('.page-overview', { timeout: 15000 })
    return
  }
  await waitHeading(label)
}

async function nav(label) {
  await clickText('.nav-item', label)
  await waitPage(label)
}

async function login(email, password) {
  await page.waitForSelector('.login-page', { timeout: 30000 })
  await page.click('.login-form input[type="email"]', { clickCount: 3 })
  await page.keyboard.press('Backspace')
  await page.type('.login-form input[type="email"]', email)
  await page.click('.login-form input[type="password"]', { clickCount: 3 })
  await page.keyboard.press('Backspace')
  await page.type('.login-form input[type="password"]', password)
  await page.click('.login-submit')
  await page.waitForSelector('.sidebar', { timeout: 30000 })
}

async function signOutFromSettings() {
  await nav('Settings')
  await clickText('.page-header-actions .button', 'Sign out')
  await page.waitForSelector('.login-page', { timeout: 15000 })
}

async function resetWorkspace() {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.location.hash = '#/overview'
  })
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.waitForSelector('.login-page', { timeout: 30000 })
}

async function fillField(label, value, root = '.overlay-panel') {
  const handle = await page.evaluateHandle(
    (scopeSelector, wanted) => {
      const scope = document.querySelector(scopeSelector)
      if (!scope) return null
      const label = [...scope.querySelectorAll('.field-label, .detail-label')].find(
        (item) => item.textContent.trim() === wanted,
      )
      const field = label?.closest('.field, .detail-field')
      return field?.querySelector('input, textarea, select') ?? null
    },
    root,
    label,
  )
  const element = handle.asElement()
  if (!element) throw new Error(`Could not find form field “${label}”`)
  const tag = await element.evaluate((node) => node.tagName)
  if (tag === 'SELECT') {
    await element.select(value)
    return
  }
  await element.click({ clickCount: 3 })
  await page.keyboard.press('Backspace')
  await page.keyboard.type(value)
}

async function textOf(selector) {
  const element = await page.$(selector)
  return element ? element.evaluate((node) => node.textContent.trim()) : null
}

async function count(selector) {
  return (await page.$$(selector)).length
}

async function screenshot(name) {
  const file = path.join(ARTIFACTS, name)
  await page.screenshot({ path: file, fullPage: false })
  report.push({ screenshot: file })
  return file
}

async function readWorkspace() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('cadence.workspace.v1') || 'null'))
}

async function dragCardToColumn(cardTitle, columnLabel) {
  return page.evaluate(
    async (title, statusLabel) => {
      const card = [...document.querySelectorAll('.kanban-card')].find((item) =>
        item.querySelector('h3')?.textContent.includes(title),
      )
      const column = [...document.querySelectorAll('.kanban-column')].find(
        (item) => item.querySelector('h2')?.textContent.trim() === statusLabel,
      )
      if (!card || !column) return { ok: false, reason: 'card or column missing' }
      const dataTransfer = new DataTransfer()
      card.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }),
      )
      await new Promise((resolve) => setTimeout(resolve, 120))
      column.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }),
      )
      await new Promise((resolve) => setTimeout(resolve, 60))
      column.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }),
      )
      card.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }))
      await new Promise((resolve) => setTimeout(resolve, 250))
      return { ok: true }
    },
    cardTitle,
    columnLabel,
  )
}

async function main() {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: PROFILE,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--disable-features=PasswordManagerOnboarding,PasswordManagerRedesign,AutofillServerCommunication,PasswordLeakDetection',
      '--disable-save-password-bubble',
      '--password-store=basic',
    ],
  })
  page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 })

  await runStep('Fresh login screen', async () => {
    await page.waitForSelector('.login-page', { timeout: 30000 })
    assert((await textOf('.login-panel h2')) === 'Welcome back.', 'Login heading missing')
    assert(await page.$('.demo-accounts'), 'Demo accounts missing')
    assert((await count('.demo-account')) === 4, 'Expected four demo accounts')
    await screenshot('01-login.png')
    note('Login screen renders with four demo teammates')
  })

  await runStep('Admin manual sign-in and remembered session', async () => {
    await login('ava@cadence.app', 'admin123')
    await waitPage('Overview')
    assert((await page.evaluate(() => location.hash)) === '#/overview', 'Admin should land on Overview')
    const stored = await page.evaluate(() => ({
      data: Boolean(localStorage.getItem('cadence.workspace.v1')),
      session: Boolean(localStorage.getItem('cadence.session.v1')),
      sessionOnly: Boolean(sessionStorage.getItem('cadence.session.v1')),
    }))
    assert(stored.data && stored.session && !stored.sessionOnly, 'Admin session was not persisted locally')
    note('Signed in as Ava Chen; workspace and remembered session saved')

    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.sidebar', { timeout: 30000 })
    await waitPage('Overview')
    note('Session survived a full page reload')
    await screenshot('02-overview-admin.png')
  })

  await runStep('Create a task with detail, step, and comment', async () => {
    await page.click('.topbar-new')
    await page.waitForSelector('.overlay-panel')
    assert((await textOf('.overlay-header h2')) === 'New task', 'Task composer did not open')
    await page.type('.task-title-field', QA_TASK)
    await fillField('Priority', 'high')
    await fillField('Labels', 'QA, Smoke')
    await clickText('.quick-date-row .chip-button', 'Today')
    await clickText('.overlay-footer .button-primary', 'Create task')
    await page.waitForSelector('.task-detail', { timeout: 10000 })
    const titleInput = await page.$eval('[aria-label="Task title"]', (element) => element.value)
    assert(titleInput === QA_TASK, 'Task detail did not open for the new task')

    await page.type('[aria-label="Add a step"]', 'Verify local persistence')
    await page.keyboard.press('Enter')
    await waitForText('.subtask-list', 'Verify local persistence')
    const newStepProgress = await page.$eval('.subtask-progress', (node) => ({
      label: node.getAttribute('aria-label'),
      now: node.getAttribute('aria-valuenow'),
    }))
    assert(
      newStepProgress.label === '0 of 1 steps complete' && newStepProgress.now === '0',
      'A new step did not render a 0% progress bar',
    )
    await page.click('.subtask:not(.is-done) .check-toggle')
    await page.waitForFunction(
      () => document.querySelector('.subtask-progress')?.getAttribute('aria-valuenow') === '100',
      { timeout: 10000 },
    )
    note('Step progress bar tracked 0 → 100% while completing the step')
    await page.type('[aria-label="Write a comment"]', 'Created during the smoke test.')
    await clickText('.comment-composer .button-primary', 'Comment')
    await waitForText('.comment-list', 'Created during the smoke test.')
    await screenshot('03-task-detail.png')
    await clickText('.overlay-footer .button-primary', 'Done')
    await page.waitForFunction(() => !document.querySelector('.task-detail'), { timeout: 10000 })
    note('Task created with a high priority, date, labels, step, and comment')
  })

  await runStep('Search, complete, and reopen the task', async () => {
    await nav('Tasks')
    await page.type('[aria-label="Search tasks"]', QA_TASK)
    await page.waitForSelector(`.task-row[aria-label^="${QA_TASK}"]`, { timeout: 10000 })
    const rowProgress = await page.$eval(
      `.task-row[aria-label^="${QA_TASK}"] [role="progressbar"]`,
      (node) => ({ label: node.getAttribute('aria-label'), now: node.getAttribute('aria-valuenow') }),
    )
    assert(
      rowProgress.label === '1 of 1 steps complete' && rowProgress.now === '100',
      'Task row progress did not reflect the completed step',
    )
    note('Task row progress matched the completed step')
    await page.click(`.task-row[aria-label^="${QA_TASK}"]`)
    await page.waitForSelector('.task-detail')
    await fillField('Status', 'done')
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('cadence.workspace.v1')).tasks.find(
          (item) => item.title === 'QA · Admin smoke task',
        )?.status === 'done',
      { timeout: 10000 },
    )
    const workspace = await readWorkspace()
    const task = workspace.tasks.find((item) => item.title === QA_TASK)
    assert(task && task.status === 'done', 'Completing the task did not persist')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.task-detail'), { timeout: 10000 })
    note('Task found via search and completed; status saved locally')
  })

  await runStep('Command palette and recent search memory', async () => {
    await page.click('[aria-label="Search workspace"]')
    await page.waitForSelector('.palette')
    await page.type('[aria-label="Search"]', 'Client Onboarding')
    await page.waitForSelector('.palette-item', { timeout: 10000 })
    let paletteProject = false
    for (const item of await page.$$('.palette-item')) {
      const title = await item.$eval('strong', (node) => node.textContent.trim())
      if (title === 'Client Onboarding') {
        await item.click()
        paletteProject = true
        break
      }
    }
    assert(paletteProject, 'Project result missing from the command palette')
    await waitHeading('Client Onboarding')
    await nav('Memory')
    await waitForText('.search-memory', 'Client Onboarding')
    note('Palette navigated to a project and recorded the search in Memory')
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.sidebar', { timeout: 30000 })
    await waitPage('Memory')
    note('Last route (Memory) restored after reload')
    await screenshot('04-memory.png')
  })

  await runStep('Offline app shell, session, and task creation', async () => {
    const pwa = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      const icons = await Promise.all(
        ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png'].map(async (src) => {
          const response = await fetch(src)
          return response.status
        }),
      )
      return {
        active: Boolean(registration.active),
        controller: Boolean(navigator.serviceWorker.controller),
        manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
        icons,
      }
    })
    assert(pwa.active && pwa.controller, 'Service worker is not active and controlling')
    assert(pwa.manifest === '/manifest.webmanifest', 'Manifest link missing')
    assert(pwa.icons.every((status) => status === 200), 'PWA icons did not load')
    note('Service worker active; manifest and PNG icons served')

    await page.setOfflineMode(true)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('.sidebar', { timeout: 30000 })
    await waitPage('Memory')
    note('Reloaded the signed-in workspace while fully offline')

    await nav('Tasks')
    await page.click('.topbar-new')
    await page.waitForSelector('.overlay-panel')
    await page.type('.task-title-field', OFFLINE_TASK)
    await clickText('.overlay-footer .button-primary', 'Create task')
    await page.waitForSelector('.task-detail')
    const offlineWorkspace = await readWorkspace()
    assert(
      offlineWorkspace.tasks.some((item) => item.title === OFFLINE_TASK),
      'Offline task was not written to local storage',
    )
    await clickText('.overlay-footer .button-primary', 'Done')
    await page.waitForFunction(() => !document.querySelector('.task-detail'))
    note('Created a task with the network disabled')

    await page.setOfflineMode(false)
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.sidebar', { timeout: 30000 })
    const afterOnline = await readWorkspace()
    assert(afterOnline.tasks.some((item) => item.title === OFFLINE_TASK), 'Offline task lost after reconnect')
    note('Offline task and session survived reconnect')
  })

  await runStep('Board drag and drop', async () => {
    await nav('Board')
    await page.waitForSelector('.kanban-column')
    assert(await page.$('.kanban-progress [role="progressbar"]'), 'Board cards are missing step progress')
    note('Board cards expose step progress bars')
    const result = await dragCardToColumn('Draft launch email', 'In progress')
    assert(result.ok, `Drag failed: ${result.reason}`)
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('cadence.workspace.v1')).tasks.find(
          (task) => task.title === 'Draft launch email',
        )?.status === 'in_progress',
      { timeout: 10000 },
    )
    const inProgressColumn = await page.evaluate(() => {
      const column = [...document.querySelectorAll('.kanban-column')].find(
        (item) => item.querySelector('h2')?.textContent.trim() === 'In progress',
      )
      return [...(column?.querySelectorAll('.kanban-card h3') ?? [])].map((node) => node.textContent)
    })
    assert(
      inProgressColumn.some((title) => title.includes('Draft launch email')),
      'Dropped card did not move to In progress',
    )
    note('Dragged a card from Backlog to In progress; status persisted')
    await screenshot('05-board.png')
  })

  await runStep('Calendar navigation', async () => {
    await nav('Calendar')
    await page.waitForSelector('[aria-label="Month calendar"]')
    const monthBefore = await textOf('.calendar-month-nav h2')
    await page.click('[aria-label="Next month"]')
    await page.waitForFunction(
      (before) => document.querySelector('.calendar-month-nav h2')?.textContent !== before,
      {},
      monthBefore,
    )
    await clickText('.calendar-toolbar .button-quiet', 'Today')
    const monthAfter = await textOf('.calendar-month-nav h2')
    assert(monthAfter === monthBefore, 'Today did not return to the current month')
    await clickText('.calendar-toolbar .segmented button', 'All work')
    await page.waitForSelector('.day-task-progress [role="progressbar"]', { timeout: 10000 })
    note('Calendar day panel shows step progress')
    note('Calendar renders, advances months, and returns to today')
  })

  await runStep('Mobile step progress', async () => {
    await nav('Tasks')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.sidebar', { timeout: 30000 })
    await waitHeading('Tasks')
    if (!(await page.$('.task-row-steps'))) {
      const scopeButton = await page.$('[aria-label="Task scope"] button:last-child')
      if (scopeButton) await scopeButton.click()
    }
    await page.waitForSelector('.task-row-steps', { timeout: 10000 })
    const mobileProgress = await page.evaluate(() => ({
      strips: document.querySelectorAll('.task-row-steps').length,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }))
    assert(mobileProgress.strips > 0, 'Mobile task rows are missing step progress')
    assert(!mobileProgress.overflowX, 'Step progress overflowed the mobile viewport')
    note('Task rows and step progress fit a 390 px viewport')
    await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 })
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.sidebar', { timeout: 30000 })
  })

  await runStep('Create a project', async () => {
    await nav('Projects')
    await page.click('.page-header-actions .button-primary')
    await page.waitForSelector('.overlay-panel')
    await fillField('Project name', 'QA Project')
    await fillField('Description', 'A workspace created during browser QA.')
    await fillField('Visibility', 'workspace')
    await clickText('.overlay-footer .button-primary', 'Create project')
    await waitHeading('QA Project')
    await waitForText('.page', 'QA Project')
    note('Created a workspace project and opened its detail page')
    await screenshot('06-project-detail.png')
  })

  await runStep('Invite a teammate', async () => {
    await nav('Team')
    await page.click('.page-header-actions .button-primary')
    await page.waitForSelector('.overlay-panel')
    await fillField('Full name', 'Quinn Bailey')
    await fillField('Work email', 'quinn@cadence.app')
    await fillField('Job title', 'Research Lead')
    await fillField('Department', 'Design')
    await fillField('Role', 'viewer')
    await fillField('Temporary password', 'quinn1234')
    await clickText('.overlay-footer .button-primary', 'Add teammate')
    await page.waitForFunction(() => !document.querySelector('.overlay-panel'), { timeout: 10000 })
    await waitForText('.people-grid', 'Quinn Bailey')
    note('Admin added a new viewer account with a local password')
    await screenshot('07-team.png')
  })

  await runStep('Preferences, backup download, and workspace reset', async () => {
    await nav('Settings')
    await clickText('.theme-switch button', 'Dark')
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
    await clickText('.settings-row .segmented button', 'Monday')
    await page.click('.settings-row .switch input')
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.sidebar', { timeout: 30000 })
    await waitHeading('Settings')
    const theme = await page.evaluate(() => document.documentElement.dataset.theme)
    assert(theme === 'dark', 'Dark theme did not survive reload')
    note('Dark theme survived reload')
    await screenshot('08-settings.png')

    const client = await browser.target().createCDPSession()
    await client.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOADS,
      eventsEnabled: true,
    })
    rmSync(DOWNLOADS, { recursive: true, force: true })
    mkdirSync(DOWNLOADS, { recursive: true })
    await clickText('.data-actions .button', 'Full workspace backup')
    const deadline = Date.now() + 15000
    let downloaded = ''
    while (Date.now() < deadline) {
      const candidate = readdirSync(DOWNLOADS).find((file) => file.endsWith('.json'))
      if (candidate) {
        downloaded = candidate
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    assert(downloaded, 'Full workspace backup was not downloaded')
    const backup = JSON.parse(readFileSync(path.join(DOWNLOADS, downloaded), 'utf8'))
    assert(backup.app === 'cadence', 'Backup metadata is missing')
    assert(backup.data?.version === 2, 'Backup does not contain the current workspace version')
    assert(
      backup.data.tasks.some((task) => task.title === QA_TASK),
      'Backup does not contain the workspace changes',
    )
    note(`Workspace backup downloaded and validated (${downloaded})`)

    await clickText('.danger-zone .button', 'Reset')
    await page.waitForSelector('.overlay-panel')
    await clickText('.overlay-panel .button-danger', 'Reset workspace')
    await page.waitForSelector('.login-page', { timeout: 30000 })
    const resetData = await page.evaluate(() => JSON.parse(localStorage.getItem('cadence.workspace.v1')))
    assert(
      resetData.tasks.every((task) => !task.title.startsWith('QA ·')),
      'Reset did not restore the seeded workspace',
    )
    assert(
      !(await page.evaluate(() => localStorage.getItem('cadence.session.v1'))),
      'Reset did not clear the remembered session',
    )
    note('Reset restored the demo workspace and signed the admin out')
  })

  await runStep('Manager role boundaries', async () => {
    await login('marcus@cadence.app', 'manager123')
    await waitForText('.sidebar-user', 'Marcus Reed')
    await nav('Tasks')
    assert(await page.$('.topbar-new'), 'Manager should be able to create tasks')
    await nav('Projects')
    assert(await page.$('.page-header-actions .button-primary'), 'Manager should create projects')
    await page.click('.project-card[aria-label="Open Atlas Experience Refresh"]')
    await waitHeading('Atlas Experience Refresh')
    assert(!(await page.$('[aria-label="Delete project"]')), 'Manager must not delete projects')
    await nav('Team')
    assert(!(await page.$('.page-header-actions .button-primary')), 'Manager must not add people')
    assert((await count('.person-foot .button')) === 0, 'Manager must not manage people')
    await nav('Settings')
    assert(!(await page.evaluate(() => document.body.textContent.includes('Full workspace backup'))), 'Manager saw admin backup')
    assert(!(await page.evaluate(() => document.body.textContent.includes('Reset demo workspace'))), 'Manager saw workspace reset')
    await screenshot('09-manager-settings.png')
    note('Manager can create tasks/projects but cannot delete projects, manage people, back up, or reset')
    await signOutFromSettings()
  })

  await runStep('Employee role boundaries', async () => {
    await login('maya@cadence.app', 'maya1234')
    await nav('Tasks')
    assert(await page.$('.topbar-new'), 'Employee should be able to create tasks')
    await nav('Projects')
    assert(!(await page.$('.page-header-actions .button-primary')), 'Employee must not create projects')
    await page.click('.project-card[aria-label="Open Brand System"]')
    await waitHeading('Brand System')
    assert(!(await page.$('[aria-label="Delete project"]')), 'Employee must not delete projects')
    await nav('Team')
    assert(!(await page.$('.page-header-actions .button-primary')), 'Employee must not add people')
    assert((await count('.person-foot .button')) === 0, 'Employee must not manage people')
    await nav('Settings')
    assert(!(await page.evaluate(() => document.body.textContent.includes('Full workspace backup'))), 'Employee saw admin backup')
    assert(!(await page.evaluate(() => document.body.textContent.includes('Reset demo workspace'))), 'Employee saw workspace reset')
    note('Employee can create work but has no project, people, or admin data controls')
    await signOutFromSettings()
  })

  await runStep('Viewer read-only experience', async () => {
    await login('noah@cadence.app', 'noah1234')
    await nav('Tasks')
    assert(!(await page.$('.topbar-new')), 'Viewer saw the global New task button')
    assert(await page.$('.read-only-pill'), 'Viewer read-only pill missing')
    assert((await count('.page-header-actions .button-primary')) === 0, 'Viewer saw the page New task button')
    await page.type('[aria-label="Search tasks"]', 'Schedule kickoff with legal')
    await page.waitForSelector('.task-row[aria-label^="Schedule kickoff with legal"]')
    await page.click('.task-row[aria-label^="Schedule kickoff with legal"]')
    await page.waitForSelector('.task-detail')
    assert(
      await page.$eval('[aria-label="Task title"]', (element) => element.disabled),
      'Viewer can edit the task title',
    )
    assert(
      await page.$eval('.detail-notes', (element) => element.disabled),
      'Viewer can edit task notes',
    )
    assert(!(await page.$('.comment-composer')), 'Viewer saw the comment composer')
    assert(await page.$('.comment-readonly'), 'Viewer did not see the read-only conversation note')
    assert(
      await page.evaluate(() => document.querySelector('.overlay-footer')?.textContent.includes('Read-only access')),
      'Viewer footer does not explain read-only access',
    )
    assert(
      (await page.$$eval('.check-toggle', (nodes) => nodes.every((node) => node.disabled))),
      'Viewer has an enabled completion toggle',
    )
    note('Task sheet is fully read-only for the viewer')
    await clickText('.overlay-footer .button-primary', 'Done')
    await page.waitForFunction(() => !document.querySelector('.task-detail'))

    await nav('Board')
    const draggable = await page.$$eval('.kanban-card', (nodes) =>
      nodes.some((node) => node.getAttribute('draggable') === 'true'),
    )
    assert(!draggable, 'Viewer cards are draggable')
    await nav('Projects')
    assert(!(await page.$('.page-header-actions .button-primary')), 'Viewer saw New project')
    assert(await page.$('.inline-note'), 'Viewer read-only project note missing')
    await nav('Team')
    assert(!(await page.$('.page-header-actions .button-primary')), 'Viewer saw Add teammate')
    await nav('Settings')
    assert(!(await page.$('.danger-zone')), 'Viewer saw workspace reset')
    assert(!(await page.evaluate(() => document.body.textContent.includes('Full workspace backup'))), 'Viewer saw admin backup')
    await screenshot('10-viewer-settings.png')
    note('Viewer is read-only across tasks, board, projects, team, and settings')
  })

  await runStep('Mobile navigation', async () => {
    await nav('Overview')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.sidebar', { timeout: 30000 })
    const initialBox = await page.$eval('.sidebar', (node) => node.getBoundingClientRect().x)
    assert(initialBox < 0, 'Sidebar should be off-canvas on mobile')
    await page.click('[aria-label="Open navigation"]')
    await page.waitForSelector('.sidebar.sidebar-open')
    await page.waitForFunction(
      () => (document.querySelector('.sidebar')?.getBoundingClientRect().x ?? -1) >= 0,
      { timeout: 5000 },
    )
    const openBox = await page.$eval('.sidebar', (node) => node.getBoundingClientRect().x)
    assert(openBox >= 0, 'Mobile navigation did not open')
    await screenshot('11-mobile-overview.png')
    await clickText('.nav-item', 'Tasks')
    await waitHeading('Tasks')
    await page.waitForFunction(
      () => document.querySelector('.sidebar')?.getBoundingClientRect().x < 0,
      { timeout: 5000 },
    )
    note('Sidebar is off-canvas, opens, and closes correctly on mobile')
    await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 })
    await page.reload({ waitUntil: 'networkidle0' })
  })

  await runStep('Clean session restore', async () => {
    await resetWorkspace()
    assert((await count('.demo-account')) === 4, 'Reset login screen is missing demo accounts')
    note('Fresh seed workspace presented a clean login screen')
  })
}

try {
  await main()
  report.push({ ok: true, steps, consoleErrors, pageErrors })
  console.log('\nAll browser QA checks passed.')
} catch (error) {
  currentStep = `FAILED: ${currentStep}`
  console.error(`\n✗ ${error.message}`)
  if (page) {
    try {
      const file = path.join(ARTIFACTS, 'failure.png')
      await page.screenshot({ path: file, fullPage: false })
      report.push({ failureScreenshot: file })
    } catch {
      // Ignore screenshot failures.
    }
  }
  report.push({
    ok: false,
    error: error.stack,
    currentStep,
    steps,
    consoleErrors,
    pageErrors,
  })
  process.exitCode = 1
} finally {
  writeFileSync(path.join(ARTIFACTS, 'report.json'), JSON.stringify(report, null, 2))
  const unexpected = consoleErrors.filter(
    (message) => !message.includes('ERR_INTERNET_DISCONNECTED') && !message.includes('net::ERR_FAILED'),
  )
  if (pageErrors.length) {
    console.error('Page errors:', pageErrors)
    process.exitCode = 1
  }
  if (unexpected.length) {
    console.error('Console errors:', unexpected)
    process.exitCode = 1
  }
  console.log(`Artifacts: ${ARTIFACTS}`)
  if (browser) await browser.close()
}

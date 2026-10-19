import { useEffect, useState } from 'react'
import { Compass, Home } from 'lucide-react'
import { StoreProvider, useStore } from './store/store'
import { AppUIProvider, useAppUI } from './ui/AppUI'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { CommandPalette } from './components/CommandPalette'
import { TaskComposer } from './components/TaskComposer'
import { TaskDetail } from './components/TaskDetail'
import { ToastViewport } from './components/ui'
import { BrandMark } from './components/BrandMark'
import { LoginPage } from './pages/LoginPage'
import { OverviewPage } from './pages/OverviewPage'
import { TasksPage } from './pages/TasksPage'
import { BoardPage } from './pages/BoardPage'
import { CalendarPage } from './pages/CalendarPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { TeamPage } from './pages/TeamPage'
import { MemoryPage } from './pages/MemoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { isTypingTarget } from './lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/tasks': 'Tasks',
  '/board': 'Board',
  '/calendar': 'Calendar',
  '/projects': 'Projects',
  '/team': 'Team',
  '/memory': 'Memory',
  '/settings': 'Settings',
}

function useResolvedTheme() {
  const { settings } = useStore()
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const resolved = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme
    document.documentElement.dataset.theme = resolved
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', resolved === 'dark' ? '#0b0b0d' : '#f5f5f7')
  }, [settings.theme, systemDark])

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false'
  }, [settings.reduceMotion])
}

function NotFoundPage() {
  const { navigate } = useStore()
  return (
    <div className="page not-found-page">
      <div className="not-found-card card">
        <BrandMark size="lg" />
        <span className="eyebrow">Off the map</span>
        <h1>This page isn’t here.</h1>
        <p>Maybe it moved, or maybe it never existed. Either way, there’s good work waiting elsewhere.</p>
        <div className="not-found-actions">
          <button className="button button-primary" onClick={() => navigate('/overview')}>
            <Home size={16} /> Back to overview
          </button>
          <button className="button button-secondary" onClick={() => navigate('/tasks')}>
            <Compass size={16} /> Browse tasks
          </button>
        </div>
      </div>
    </div>
  )
}

function AppShell() {
  const { route, currentUser, settings } = useStore()
  const { taskId, composerDefaults, paletteOpen, setNavOpen, openPalette, openComposer } = useAppUI()

  useEffect(() => {
    setNavOpen(false)
  }, [route, setNavOpen])

  useEffect(() => {
    const page =
      route.startsWith('/projects/') ? 'Project' : PAGE_TITLES[route] ?? 'Cadence'
    document.title = `${page} · Cadence`
  }, [route])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!currentUser) return
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (!taskId && !composerDefaults) openPalette()
        return
      }
      if (
        !mod &&
        !event.altKey &&
        !event.shiftKey &&
        !taskId &&
        !composerDefaults &&
        !paletteOpen &&
        !isTypingTarget(event.target) &&
        event.key.toLowerCase() === 'n'
      ) {
        event.preventDefault()
        openComposer()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentUser, taskId, composerDefaults, paletteOpen, openPalette, openComposer])

  let page
  if (route === '/overview') page = <OverviewPage />
  else if (route === '/tasks') page = <TasksPage />
  else if (route === '/board') page = <BoardPage />
  else if (route === '/calendar') page = <CalendarPage />
  else if (route === '/projects') page = <ProjectsPage />
  else if (route.startsWith('/projects/')) page = <ProjectDetailPage />
  else if (route === '/team') page = <TeamPage />
  else if (route === '/memory') page = <MemoryPage />
  else if (route === '/settings') page = <SettingsPage />
  else page = <NotFoundPage />

  return (
    <div className="app-shell">
      <div className="app-ambient" aria-hidden="true" />
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main className={settings.reduceMotion ? 'app-content is-reduced' : 'app-content'}>
          <div className="route-view" key={route}>
            {page}
          </div>
        </main>
      </div>
      <CommandPalette />
      <TaskComposer />
      <TaskDetail />
      <ToastViewport />
    </div>
  )
}

function Root() {
  const { currentUser } = useStore()
  const { closeTask, closeComposer, closePalette } = useAppUI()
  useResolvedTheme()

  useEffect(() => {
    closeTask()
    closeComposer()
    closePalette()
    // Reset transient overlays when the signed-in identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  if (!currentUser) {
    return (
      <>
        <LoginPage />
        <ToastViewport />
      </>
    )
  }

  return <AppShell />
}

export default function App() {
  return (
    <StoreProvider>
      <AppUIProvider>
        <Root />
      </AppUIProvider>
    </StoreProvider>
  )
}

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { TaskStatus } from '../types'

export interface ComposerDefaults {
  projectId?: string
  status?: TaskStatus
  dueDate?: string | null
  assigneeId?: string | null
}

interface AppUIValue {
  taskId: string | null
  composerDefaults: ComposerDefaults | null
  paletteOpen: boolean
  paletteSeed: string
  navOpen: boolean
  openTask: (taskId: string) => void
  closeTask: () => void
  openComposer: (defaults?: ComposerDefaults) => void
  closeComposer: () => void
  openPalette: (seed?: string) => void
  closePalette: () => void
  setNavOpen: (open: boolean) => void
}

const AppUIContext = createContext<AppUIValue | null>(null)

export function AppUIProvider({ children }: { children: ReactNode }) {
  const [taskId, setTaskId] = useState<string | null>(null)
  const [composerDefaults, setComposerDefaults] = useState<ComposerDefaults | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteSeed, setPaletteSeed] = useState('')
  const [navOpen, setNavOpen] = useState(false)

  const value = useMemo<AppUIValue>(
    () => ({
      taskId,
      composerDefaults,
      paletteOpen,
      paletteSeed,
      navOpen,
      openTask: (id: string) => {
        setPaletteOpen(false)
        setTaskId(id)
      },
      closeTask: () => setTaskId(null),
      openComposer: (defaults?: ComposerDefaults) => {
        setPaletteOpen(false)
        setComposerDefaults(defaults ?? {})
      },
      closeComposer: () => setComposerDefaults(null),
      openPalette: (seed?: string) => {
        setPaletteSeed(seed ?? '')
        setPaletteOpen(true)
      },
      closePalette: () => setPaletteOpen(false),
      setNavOpen,
    }),
    [taskId, composerDefaults, paletteOpen, navOpen, paletteSeed],
  )

  return <AppUIContext.Provider value={value}>{children}</AppUIContext.Provider>
}

export function useAppUI(): AppUIValue {
  const context = useContext(AppUIContext)
  if (!context) throw new Error('useAppUI must be used inside AppUIProvider.')
  return context
}

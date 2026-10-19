import { useEffect, useRef, useState } from 'react'
import { Brain, ChevronDown, LogOut, Menu, Plus, Search, Settings2, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { Avatar, Kbd, RoleBadge } from './ui'
import { canCreateTask } from '../lib/permissions'
import { cx } from '../lib/utils'

export function Topbar() {
  const { currentUser, navigate, logout } = useStore()
  const { openPalette, openComposer, setNavOpen } = useAppUI()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const user = currentUser!

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button topbar-menu" onClick={() => setNavOpen(true)} aria-label="Open navigation">
          <Menu size={19} />
        </button>
        <button className="topbar-search" onClick={() => openPalette()} aria-label="Search workspace">
          <Search size={16} />
          <span className="topbar-search-label">Search tasks, projects, people…</span>
          <span className="topbar-search-key"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        </button>
      </div>

      <div className="topbar-right">
        <span className="topbar-local">
          <span className="local-dot" />
          Local
        </span>
        {canCreateTask(user) && (
          <button className="button button-primary button-compact topbar-new" onClick={() => openComposer()}>
            <Plus size={16} />
            <span>New task</span>
          </button>
        )}
        <div className="topbar-user" ref={menuRef}>
          <button
            className={cx('topbar-avatar-button', menuOpen && 'is-open')}
            onClick={() => setMenuOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar name={user.name} tone={user.tone} size="sm" />
            <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <div className="user-menu" role="menu">
              <div className="user-menu-head">
                <Avatar name={user.name} tone={user.tone} size="md" />
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
              </div>
              <div className="user-menu-role">
                <RoleBadge role={user.role} />
                <span>{user.department}</span>
              </div>
              <div className="user-menu-sep" />
              <button
                className="user-menu-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/settings')
                }}
              >
                <Settings2 size={16} /> Settings
              </button>
              <button
                className="user-menu-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/memory')
                }}
              >
                <Brain size={16} /> Memory
              </button>
              {user.role === 'admin' && (
                <button
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/team')
                  }}
                >
                  <ShieldCheck size={16} /> Access control
                </button>
              )}
              <div className="user-menu-sep" />
              <button
                className="user-menu-item user-menu-danger"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
              >
                <LogOut size={16} /> Sign out
              </button>
              <p className="user-menu-foot">Stored locally · Cadence 1.0</p>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

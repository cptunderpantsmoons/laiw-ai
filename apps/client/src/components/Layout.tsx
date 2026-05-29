import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/matters', label: 'Matters', icon: '📁' },
  { path: '/contracts', label: 'Contracts', icon: '📝' },
  { path: '/tasks', label: 'Tasks', icon: '✅' },
  { path: '/spend', label: 'Spend', icon: '💰' },
  { path: '/insights', label: 'Insights', icon: '📈' },
  { path: '/kb', label: 'Knowledge Base', icon: '📚' },
]

const navItemsBelow = [
  { path: '/billing', label: 'Billing', icon: '💼' },
  { path: '/contacts', label: 'Contacts', icon: '👥' },
  { path: '/matter-types', label: 'Matter Types', icon: '🏷️' },
  { path: '/custom-fields', label: 'Custom Fields', icon: '⚙️' },
  { path: '/intake/admin', label: 'Intake', icon: '📋' },
]

function decodeUserFromToken(token: string): string | null {
  try {
    const decoded = atob(token)
    const parts = decoded.split(':')
    return parts[1] || parts[0] || null
  } catch {
    return null
  }
}

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showSignout, setShowSignout] = useState(false)

  const token = localStorage.getItem('laiw-token')
  const userEmail = token ? decodeUserFromToken(token) : null
  const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : 'U'

  const onMatterDetail = location.pathname.startsWith('/matters/') && location.pathname.split('/').length > 3

  function handleSignout() {
    localStorage.removeItem('laiw-token')
    navigate('/login')
  }

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Laiw</h1>
              <p className="text-xs text-slate-400 mt-1">Legal Operating System</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
              AI
            </span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(item.path)
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Section divider when on matter detail */}
          {onMatterDetail && (
            <div className="pt-2 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3">Matter Tools</span>
            </div>
          )}

          {/* Matter-specific items */}
          {onMatterDetail && (
            <Link
              to={`/audit/${location.pathname.split('/')[2]}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive('/audit')
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>📋</span>
              <span>Audit Log</span>
            </Link>
          )}

          {/* Secondary nav items */}
          <div className="pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3">Management</span>
          </div>
          {navItemsBelow.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(item.path)
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          {/* User info */}
          {userEmail && (
            <div className="flex items-center gap-2 mb-3 px-2">
              <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold">
                {userInitial}
              </div>
              <span className="text-xs text-slate-300 truncate">{userEmail}</span>
            </div>
          )}
          {/* Signout trigger */}
          <div className="relative">
            <button
              onClick={() => setShowSignout(!showSignout)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full px-2 py-1 rounded-lg hover:bg-slate-800"
            >
              <span>🚪</span>
              <span>Sign out</span>
            </button>
            {showSignout && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSignout(false)} />
                <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 w-48 overflow-hidden">
                  <button
                    onClick={handleSignout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Confirm sign out
                  </button>
                  <button
                    onClick={() => setShowSignout(false)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors border-t border-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

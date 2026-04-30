import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Settings, LogOut, Menu, X, Users, ChevronLeft, } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isConversationOpen = /^\/messages\/[^/]+$/.test(location.pathname);

  // Redirect if not logged in (already handled by AuthGuard, but double-check)
  if (!loading && !user) {
    navigate('/', { replace: true });
    return null;
  }

  const navItems = [
    { to: '/messages', label: 'Messages', icon: MessageCircle },
    { to: '/group-chats', label: 'Groups', icon: Users },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const SidebarContent = ({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) => (
    <div className="flex flex-col h-full bg-gray-100 border-r border-gray-200">
      {/* Header with logo and collapse toggle */}
      <div className="px-2 py-2 flex items-center justify-between">
        {/* Logo */}
        {!collapsed && (
          <div className="flex items-center gap-2 text-3xl font-bold">
            <span className="bg-gradient-to-r from-gray-500 to-gray-700 bg-clip-text text-transparent drop-shadow-sm">
              hzoom
            </span>
          </div>
        )}
        {/* Toggle button - always visible on desktop */}
        <button
          onClick={onToggle}
          className="px-4 py-4 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors hidden md:block cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <Menu size={24} /> :  <ChevronLeft size={24} />}
        </button>
      </div>
    {/* Navigation */}
      <nav className="flex-1 px-2 py-6 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gray-200 text-gray-800 shadow-sm'   // changed from blue to gray
                  : 'text-gray-600 hover:bg-gray-50 hover:text-blue-500'
              } ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={20} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-2 border-t border-gray-100">
        {user && (
          <div className={`flex items-center gap-3 mb-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium shadow-sm flex-shrink-0">
              {(user.name?.[0] || user.email?.[0] || 'U').toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 truncate">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {user.name || user.email?.split('@')[0]}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            )}
          </div>
        )}
        <button
          onClick={logout}
          className={`w-full flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Sign out"
        >
          <LogOut size={16} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans overflow-x-hidden">
      {/* Mobile menu button */}
      {!isConversationOpen && (
        <div className="md:hidden fixed top-4 left-4 z-50">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 bg-white rounded-full shadow-md border border-gray-100"
          >
            {mobileOpen ? <X size={20} className="text-gray-600" /> : <Menu size={20} className="text-gray-600" />}
          </button>
        </div>
      )}

      {/* Desktop sidebar – collapsible */}
      <aside
        className={`hidden md:block fixed left-0 top-0 h-full z-40 shadow-sm transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarContent collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-white z-50 transform transition-transform duration-200 shadow-xl ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent collapsed={false} onToggle={() => {}} />
      </div>

      {/* Main content area */}
      <main
        className={`h-screen transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
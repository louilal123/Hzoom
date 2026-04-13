import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MessageCircle, Settings, LogOut, Menu, X } from 'lucide-react';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import logo from '../assets/hzoom_logo.png';

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navItems = [
    { to: '/messages', label: 'Messages', icon: MessageCircle },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      <div className="flex justify-center py-8">
        <img src={logo} alt="HZoom Logo" className="h-12 w-auto" />
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-blue-500'
              }`
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-100">
        {/* User info – you can fetch from context later */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 bg-white rounded-full shadow-md border border-gray-100"
        >
          {mobileOpen ? <X size={20} className="text-gray-600" /> : <Menu size={20} className="text-gray-600" />}
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:block fixed left-0 top-0 h-full w-64 z-40 shadow-sm">
        <SidebarContent />
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
        <SidebarContent />
      </div>
    </>
  );
}
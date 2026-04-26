// src/components/Layout.tsx
import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Sidebar from './Sidebar';

export default function Layout() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/', { replace: true });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      {/* On mobile: no left margin (sidebar is a drawer overlay).
          On desktop (md+): leave room for the fixed 64-wide sidebar. */}
      <main className="md:ml-64 h-screen overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
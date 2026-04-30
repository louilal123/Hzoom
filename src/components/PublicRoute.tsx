// src/components/PublicRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function PublicRoute() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  // If authenticated, redirect to messages page
  return user ? <Navigate to="/messages" replace /> : <Outlet />;
}
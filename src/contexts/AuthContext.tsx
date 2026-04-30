import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface AuthUser {
  uid: string;
  email: string | null;
  name: string;
  photoURL?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: userData.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        photoURL: userData.photoURL || firebaseUser.photoURL || undefined,
      });
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
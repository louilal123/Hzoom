// src\components\PresenceListener.tsx
import { useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function PresenceListener() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'presence', user.uid);

    // Set immediately
    setDoc(docRef, { lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);

    // Every 10 seconds
    const id = setInterval(() => {
      setDoc(docRef, { lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
    }, 10_000);

    return () => clearInterval(id);
  }, [user]);

  return null; // no UI
}
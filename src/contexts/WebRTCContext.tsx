// src/contexts/WebRTCContext.tsx
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { db, auth } from '../config/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface IncomingCallInfo {
  callId: string;
  callerId: string;
  isVideo: boolean;
  callerName: string;
}

interface WebRTCContextType {
  incomingCallInfo: IncomingCallInfo | null;
  clearIncomingCall: () => void;
  markCallAsAccepted: (callId: string) => void;
}

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);

export const useWebRTC = () => {
  const ctx = useContext(WebRTCContext);
  if (!ctx) throw new Error('useWebRTC must be used within WebRTCProvider');
  return ctx;
};

export const WebRTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [incomingCallInfo, setIncomingCallInfo] = useState<IncomingCallInfo | null>(null);
  const acceptedCalls = useRef<Set<string>>(new Set());

  const getUserName = async (userId: string): Promise<string> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      return userDoc.exists() ? (userDoc.data().name || userDoc.data().email || userId) : userId;
    } catch {
      return userId;
    }
  };

  const markCallAsAccepted = (callId: string) => {
    acceptedCalls.current.add(callId);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(
        collection(db, 'calls'),
        where('calleeId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const callId = change.doc.id;
            // Ignore if already accepted
            if (acceptedCalls.current.has(callId)) continue;

            const data = change.doc.data();
            const createdAt = data.createdAt?.toDate();
            // Ignore stale calls (older than 60 seconds)
            if (createdAt && (Date.now() - createdAt.getTime() > 60000)) {
              // Optionally mark as expired to prevent future appearances
              await updateDoc(doc(db, 'calls', callId), { status: 'expired' }).catch(console.error);
              continue;
            }
            const callerName = await getUserName(data.callerId);
            setIncomingCallInfo({
              callId,
              callerId: data.callerId,
              isVideo: data.isVideo,
              callerName,
            });
          }
        }
      });
      return () => unsubscribe();
    });
    return () => unsubscribeAuth();
  }, []);

  const clearIncomingCall = () => {
    setIncomingCallInfo(null);
  };

  return (
    <WebRTCContext.Provider value={{ incomingCallInfo, clearIncomingCall, markCallAsAccepted }}>
      {children}
    </WebRTCContext.Provider>
  );
};
// src/contexts/WebRTCContext.tsx
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { db, auth } from '../config/firebase';
import { collection, doc, setDoc, onSnapshot, updateDoc, query, where, getDoc, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

interface CallData {
  callId: string;
  callerId: string;
  calleeId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  iceCandidates: RTCIceCandidateInit[];
  status: 'pending' | 'active' | 'ended';
  isVideo: boolean;
  createdAt: Date;
}

interface WebRTCContextType {
  callStatus: CallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  incomingCallInfo: { callId: string; callerId: string; isVideo: boolean } | null;
  startCall: (receiverId: string, isVideo: boolean) => Promise<void>;
  acceptCall: (callId: string, isVideo: boolean) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  cancelCall: () => void;
  endCall: () => void;
}

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);

export const useWebRTC = () => {
  const ctx = useContext(WebRTCContext);
  if (!ctx) throw new Error('useWebRTC must be used within WebRTCProvider');
  return ctx;
};

export const WebRTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [incomingCallInfo, setIncomingCallInfo] = useState<{ callId: string; callerId: string; isVideo: boolean } | null>(null);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const currentCallId = useRef<string | null>(null);
  const unsubscribeSignal = useRef<(() => void) | null>(null);

  // Listen for incoming calls (pending, callee = current user)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(
        collection(db, 'calls'),
        where('calleeId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as CallData;
            setIncomingCallInfo({
              callId: change.doc.id,
              callerId: data.callerId,
              isVideo: data.isVideo,
            });
            setCallStatus('incoming');
          }
        });
      });
      return () => unsubscribe();
    });
    return () => unsubscribeAuth();
  }, []);

  const createPeerConnection = (onRemoteStream: (stream: MediaStream) => void) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pc.onicecandidate = (event) => {
      if (event.candidate && currentCallId.current) {
        const callRef = doc(db, 'calls', currentCallId.current);
        updateDoc(callRef, {
          iceCandidates: arrayUnion(event.candidate.toJSON()),
        });
      }
    };
    pc.ontrack = (event) => {
      onRemoteStream(event.streams[0]);
    };
    return pc;
  };

  const startCall = async (receiverId: string, isVideo: boolean) => {
    // 1. Immediately switch UI to "calling" state
    setCallStatus('calling');
    
    try {
      // 2. Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
      setLocalStream(stream);

      // 3. Create RTCPeerConnection
      const pc = createPeerConnection((remote) => {
        setRemoteStream(remote);
        setCallStatus('connected');
      });
      peerConnection.current = pc;

      // 4. Add local tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 5. Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 6. Store call in Firestore
      const callId = `${Date.now()}_${Math.random().toString(36)}`;
      currentCallId.current = callId;
      const callData: CallData = {
        callId,
        callerId: auth.currentUser!.uid,
        calleeId: receiverId,
        offer: offer,
        iceCandidates: [],
        status: 'pending',
        isVideo,
        createdAt: new Date(),
      };
      await setDoc(doc(db, 'calls', callId), callData);

      // 7. Listen for answer and ICE candidates
      unsubscribeSignal.current = onSnapshot(doc(db, 'calls', callId), (snap) => {
        const data = snap.data() as CallData;
        if (data?.answer && pc.remoteDescription === null) {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(console.error);
        }
        if (data?.iceCandidates && pc.remoteDescription) {
          data.iceCandidates.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
          });
        }
        if (data?.status === 'ended') {
          endCall();
        }
      });
    } catch (err) {
      console.error('startCall error:', err);
      cancelCall();
    }
  };

  const acceptCall = async (callId: string, isVideo: boolean) => {
    try {
      const callRef = doc(db, 'calls', callId);
      const callSnap = await getDoc(callRef);
      const callData = callSnap.data() as CallData;
      if (!callData) return;

      const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
      setLocalStream(stream);
      setCallStatus('connected');

      const pc = createPeerConnection((remote) => {
        setRemoteStream(remote);
      });
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer!));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(callRef, { answer: answer, status: 'active' });

      currentCallId.current = callId;
      unsubscribeSignal.current = onSnapshot(callRef, (snap) => {
        const data = snap.data() as CallData;
        if (data?.iceCandidates && pc.remoteDescription) {
          data.iceCandidates.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
          });
        }
        if (data?.status === 'ended') {
          endCall();
        }
      });
      setIncomingCallInfo(null);
    } catch (err) {
      console.error('acceptCall error:', err);
      endCall();
    }
  };

  const rejectCall = async (callId: string) => {
    await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
    setIncomingCallInfo(null);
    setCallStatus('idle');
  };

  const cancelCall = () => {
    if (currentCallId.current) {
      updateDoc(doc(db, 'calls', currentCallId.current), { status: 'ended' }).catch(console.error);
    }
    endCall();
  };

  const endCall = () => {
    if (peerConnection.current) peerConnection.current.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    peerConnection.current = null;
    if (currentCallId.current) {
      updateDoc(doc(db, 'calls', currentCallId.current), { status: 'ended' }).catch(console.error);
    }
    if (unsubscribeSignal.current) unsubscribeSignal.current();
    currentCallId.current = null;
  };

  return (
    <WebRTCContext.Provider value={{
      callStatus,
      localStream,
      remoteStream,
      incomingCallInfo,
      startCall,
      acceptCall,
      rejectCall,
      cancelCall,
      endCall,
    }}>
      {children}
    </WebRTCContext.Provider>
  );
};
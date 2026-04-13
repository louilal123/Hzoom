import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { db, auth } from '../config/firebase';
import { collection, doc, setDoc, onSnapshot, updateDoc, query, where, getDoc, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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
  startCall: (receiverId: string, isVideo: boolean) => Promise<void>;
  endCall: () => void;
  acceptCall: (callId: string, isVideo: boolean) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  isInCall: boolean;
  incomingCall: { callId: string; callerId: string; isVideo: boolean } | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);

export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) throw new Error('useWebRTC must be used within WebRTCProvider');
  return context;
};

export const WebRTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ callId: string; callerId: string; isVideo: boolean } | null>(null);
  const currentCallId = useRef<string | null>(null);
  const unsubscribeSignal = useRef<(() => void) | null>(null);

  // Listen for incoming calls
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const callsQuery = query(
        collection(db, 'calls'),
        where('calleeId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as CallData;
            setIncomingCall({
              callId: change.doc.id,
              callerId: data.callerId,
              isVideo: data.isVideo,
            });
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
      setLocalStream(stream);

      const pc = createPeerConnection((remote) => {
        setRemoteStream(remote);
        setIsInCall(true);
      });
      setPeerConnection(pc);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

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

      unsubscribeSignal.current = onSnapshot(doc(db, 'calls', callId), (snap) => {
        const data = snap.data() as CallData;
        // Only set remote description if not already set
        if (data?.answer && pc.remoteDescription === null) {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(console.error);
        }
        // Only add ICE candidates if remote description exists
        if (data?.iceCandidates && data.iceCandidates.length > 0 && pc.remoteDescription) {
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

      const pc = createPeerConnection((remote) => {
        setRemoteStream(remote);
        setIsInCall(true);
      });
      setPeerConnection(pc);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer!));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(callRef, { answer: answer, status: 'active' });

      currentCallId.current = callId;

      unsubscribeSignal.current = onSnapshot(callRef, (snap) => {
        const data = snap.data() as CallData;
        // Only add ICE candidates if remote description exists
        if (data?.iceCandidates && data.iceCandidates.length > 0 && pc.remoteDescription) {
          data.iceCandidates.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
          });
        }
        if (data?.status === 'ended') {
          endCall();
        }
      });

      setIncomingCall(null);
    } catch (err) {
      console.error('acceptCall error:', err);
    }
  };

  const rejectCall = async (callId: string) => {
    await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
    setIncomingCall(null);
  };

  const endCall = () => {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setIsInCall(false);
    setPeerConnection(null);
    if (currentCallId.current) {
      updateDoc(doc(db, 'calls', currentCallId.current), { status: 'ended' }).catch(console.error);
    }
    if (unsubscribeSignal.current) unsubscribeSignal.current();
    currentCallId.current = null;
  };

  return (
    <WebRTCContext.Provider
      value={{
        startCall,
        endCall,
        acceptCall,
        rejectCall,
        isInCall,
        incomingCall,
        localStream,
        remoteStream,
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
};
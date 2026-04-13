// src/contexts/CallContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface CallContextType {
  startCall: (receiverId: string, isVideo: boolean) => Promise<void>;
  endCall: () => void;
  isInCall: boolean;
  incomingCall: any | null;
  acceptCall: (stream: MediaStream) => void;
  rejectCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const currentCall = useRef<any>(null);

  // Initialize Peer when user is authenticated (and clean up on logout)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Destroy existing peer instance if any
      if (peer) {
        peer.destroy();
        setPeer(null);
      }

      if (!user) return;

      // Create new peer with user's UID
      const peerInstance = new Peer(user.uid);

      peerInstance.on('open', (id) => {
        console.log('✅ PeerJS ready. My ID:', id);
        setPeer(peerInstance);
      });

      peerInstance.on('call', (call) => {
        console.log('📞 Incoming call from:', call.peer);
        setIncomingCall(call);
      });

      peerInstance.on('error', (err) => {
        console.error('❌ PeerJS error:', err);
      });

      peerInstance.on('disconnected', () => {
        console.log('⚠️ PeerJS disconnected');
      });
    });

    return () => unsubscribe();
  }, []);

  const startCall = async (receiverId: string, isVideo: boolean) => {
    console.log('📞 startCall called with receiverId:', receiverId, 'isVideo:', isVideo);
    console.log('📞 current peer instance:', peer);
    if (!peer) {
      console.error('❌ Peer not initialized!');
      return;
    }
    try {
      console.log('📞 Requesting user media...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
      console.log('📞 Got local stream, tracks:', stream.getTracks().length);
      setLocalStream(stream);
      console.log('📞 Calling peer.call...');
      const call = peer.call(receiverId, stream);
      currentCall.current = call;

      call.on('stream', (remoteStream) => {
        console.log('📞 Received remote stream');
        setRemoteStream(remoteStream);
        setIsInCall(true);
      });

      call.on('close', () => {
        console.log('📞 Call closed');
        endCall();
      });

      call.on('error', (err) => {
        console.error('📞 Call error:', err);
      });

      setIsInCall(true);
      console.log('📞 Call initiated, waiting for answer...');
    } catch (err) {
      console.error('Failed to start call:', err);
    }
  };

  const acceptCall = async (stream: MediaStream) => {
    if (!incomingCall) return;
    setLocalStream(stream);
    incomingCall.answer(stream);
    incomingCall.on('stream', (remoteStream: MediaStream) => {
      setRemoteStream(remoteStream);
      setIsInCall(true);
    });
    incomingCall.on('close', () => {
      endCall();
    });
    setIncomingCall(null);
    setIsInCall(true);
  };

  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.close();
      setIncomingCall(null);
    }
  };

  const endCall = () => {
    if (currentCall.current) currentCall.current.close();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsInCall(false);
    currentCall.current = null;
  };

  return (
    <CallContext.Provider value={{
      startCall,
      endCall,
      isInCall,
      incomingCall,
      acceptCall,
      rejectCall,
      localStream,
      remoteStream,
    }}>
      {children}
    </CallContext.Provider>
  );
};
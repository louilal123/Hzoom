import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { doc, setDoc, onSnapshot, updateDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { Mic, Video, PhoneOff } from 'lucide-react';

export default function CallPage() {
  const [searchParams] = useSearchParams();
  const receiverId = searchParams.get('receiverId');
  const callIdParam = searchParams.get('callId');
  const isVideo = searchParams.get('isVideo') === 'true';
  const currentUser = auth.currentUser;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [callId, setCallId] = useState<string | null>(callIdParam || null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const unsubscribeSignal = useRef<(() => void) | null>(null);
  const callStartTimeRef = useRef<number | null>(null); // 👈 track connected time

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const createPeerConnection = (onRemoteStream: (stream: MediaStream) => void) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pc.onicecandidate = (event) => {
      if (event.candidate && callId) {
        const callRef = doc(db, 'calls', callId);
        updateDoc(callRef, { iceCandidates: arrayUnion(event.candidate.toJSON()) }).catch(console.error);
      }
    };
    pc.ontrack = (event) => {
      console.log('📹 ontrack: received', event.track.kind, 'track');
      onRemoteStream(event.streams[0]);
      setCallStatus('connected');
      callStartTimeRef.current = Date.now(); // 👈 call connected
    };
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
    };
    return pc;
  };

  const endCall = async () => {
    if (peerConnection.current) peerConnection.current.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    
    if (callId) {
      try {
        const callRef = doc(db, 'calls', callId);
        let durationSec = 0;
        if (callStartTimeRef.current) {
          durationSec = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        } else {
          const callSnap = await getDoc(callRef);
          const callData = callSnap.data();
          if (callData?.createdAt) {
            const start = callData.createdAt.toDate ? callData.createdAt.toDate() : new Date(callData.createdAt);
            durationSec = Math.floor((Date.now() - start.getTime()) / 1000);
          }
        }
        await updateDoc(callRef, {
          status: 'ended',
          endedAt: Timestamp.now(),
          duration: durationSec,
        });
      } catch (err) {
        console.error('Error saving call end data:', err);
      }
    }
    
    if (unsubscribeSignal.current) unsubscribeSignal.current();
    window.close();
  };

  useEffect(() => {
    if (!currentUser) {
      window.close();
      return;
    }

    if (receiverId && !callIdParam) {
      // Caller
      const initCall = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
          setLocalStream(stream);

          const pc = createPeerConnection((remote) => {
            setRemoteStream(remote);
            // connection start time already set in ontrack
          });
          peerConnection.current = pc;

          stream.getTracks().forEach(track => pc.addTrack(track, stream));

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const newCallId = `${Date.now()}_${Math.random().toString(36)}`;
          setCallId(newCallId);
          const callRef = doc(db, 'calls', newCallId);
          await setDoc(callRef, {
            callId: newCallId,
            callerId: currentUser.uid,
            calleeId: receiverId,
            participants: [currentUser.uid, receiverId], // 👈 added
            offer,
            iceCandidates: [],
            status: 'pending',
            isVideo,
            createdAt: Timestamp.now(),
          });

          unsubscribeSignal.current = onSnapshot(callRef, (snap) => {
            const data = snap.data();
            if (data?.answer && pc.remoteDescription === null) {
              pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
            if (data?.iceCandidates && pc.remoteDescription) {
              data.iceCandidates.forEach((candidate: any) => {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
              });
            }
            if (data?.status === 'ended') endCall();
          });
        } catch (err) {
          console.error('Caller init error:', err);
          endCall();
        }
      };
      initCall();
    } else if (callIdParam) {
      // Callee
      const answerCall = async () => {
        try {
          const callRef = doc(db, 'calls', callIdParam);
          const callSnap = await getDoc(callRef);
          const callData = callSnap.data();
          if (!callData || (callData.status !== 'pending' && callData.status !== 'ringing')) {
            window.close();
            return;
          }

          const stream = await navigator.mediaDevices.getUserMedia({ video: callData.isVideo, audio: true });
          setLocalStream(stream);

          const pc = createPeerConnection((remote) => {
            setRemoteStream(remote);
            // connection start time already set in ontrack
          });
          peerConnection.current = pc;

          stream.getTracks().forEach(track => pc.addTrack(track, stream));

          await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await updateDoc(callRef, { answer, status: 'active' });

          setCallId(callIdParam);

          unsubscribeSignal.current = onSnapshot(callRef, (snap) => {
            const data = snap.data();
            if (data?.iceCandidates && pc.remoteDescription) {
              data.iceCandidates.forEach((candidate: any) => {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
              });
            }
            if (data?.status === 'ended') endCall();
          });
        } catch (err) {
          console.error('Callee answer error:', err);
          endCall();
        }
      };
      answerCall();
    } else {
      window.close();
    }

    return () => {
      if (unsubscribeSignal.current) unsubscribeSignal.current();
    };
  }, []);

  const toggleAudio = () => {
    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
  };
  const toggleVideo = () => {
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.onloadedmetadata = () => {
        localVideoRef.current?.play().catch(e => console.warn('Play failed:', e));
      };
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.onloadedmetadata = () => {
        remoteVideoRef.current?.play().catch(e => console.warn('Play failed:', e));
      };
    }
  }, [remoteStream]);

  if (callStatus === 'calling') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
        <video ref={localVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
          <div className="text-white text-2xl font-semibold mb-6"> Connecting...</div>
          <button onClick={endCall} className="p-4 rounded-full bg-red-600 hover:bg-red-700">
            <PhoneOff size={28} />
          </button>
        </div>
      </div>
    );
  }

  if (callStatus === 'connected') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-xl bg-black/70">
            Connecting...
          </div>
        )}
        <div className="absolute bottom-6 right-6 w-36 h-48 bg-black rounded-xl overflow-hidden shadow-xl border-2 border-white/30 z-10">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        </div>
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6 z-20">
          <button onClick={toggleAudio} className="p-4 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white backdrop-blur-sm">
            <Mic size={24} />
          </button>
          <button onClick={toggleVideo} className="p-4 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white backdrop-blur-sm">
            <Video size={24} />
          </button>
          <button onClick={endCall} className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg">
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
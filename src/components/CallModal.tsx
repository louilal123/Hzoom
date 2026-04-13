import { useEffect, useRef, useState } from 'react';
import { useWebRTC } from '../contexts/WebRTCContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, X, Phone } from 'lucide-react';

export default function CallModal() {
  const { incomingCall, acceptCall, rejectCall, endCall, isInCall, localStream, remoteStream, isCalling, cancelCall } = useWebRTC();
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callerName, setCallerName] = useState('Someone');

  useEffect(() => {
    if (incomingCall) {
      // Fetch caller name from Firestore (simplified: use ID)
      setCallerName(incomingCall.callerId.slice(0, 6));
    }
  }, [incomingCall]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      acceptCall(incomingCall.callId, incomingCall.isVideo);
    }
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      rejectCall(incomingCall.callId);
    }
  };

  // Outgoing call (waiting for answer)
  if (isCalling) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Local video preview full screen */}
        <video ref={localVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
          <div className="text-white text-2xl font-semibold mb-4">Calling...</div>
          <button onClick={cancelCall} className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition">
            <PhoneOff size={28} />
          </button>
        </div>
        
        {/* Local video small preview (optional, but shows the local stream) – not needed because full-screen already shows it */}
      </div>
    );
  }

  // Incoming call popup (Messenger style)
  if (incomingCall && !isInCall) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
        <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden border border-gray-200">
          <div className="flex items-center gap-3 p-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
              {callerName[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{callerName}</p>
              <p className="text-sm text-gray-500">Incoming {incomingCall.isVideo ? 'video' : 'audio'} call...</p>
            </div>
          </div>
          <div className="flex border-t border-gray-100">
            <button onClick={handleAcceptCall} className="flex-1 py-3 flex items-center justify-center gap-2 text-green-600 font-medium hover:bg-green-50 transition">
              <Phone size={18} /> Accept
            </button>
            <button onClick={handleRejectCall} className="flex-1 py-3 flex items-center justify-center gap-2 text-red-600 font-medium hover:bg-red-50 transition border-l border-gray-100">
              <X size={18} /> Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active call UI (full screen)
  if (isInCall && remoteStream) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute bottom-6 right-6 w-36 h-48 bg-black rounded-xl overflow-hidden shadow-xl border-2 border-white/30 z-10">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        </div>
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6 z-20">
          <button onClick={toggleAudio} className="p-4 rounded-full bg-gray-800/80 hover:bg-gray-700 transition text-white backdrop-blur-sm">
            {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          <button onClick={toggleVideo} className="p-4 rounded-full bg-gray-800/80 hover:bg-gray-700 transition text-white backdrop-blur-sm">
            {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
          <button onClick={endCall} className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition text-white shadow-lg">
            <PhoneOff size={24} />
          </button>
        </div>
        <div className="absolute top-6 left-6 text-white text-lg font-semibold bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
          {callerName}
        </div>
      </div>
    );
  }

  return null;
}
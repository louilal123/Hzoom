// src/components/CallModal.tsx
import { useEffect, useRef } from 'react';
import { useWebRTC } from '../contexts/WebRTCContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, X, Phone } from 'lucide-react';

export default function CallModal() {
  const { callStatus, localStream, remoteStream, incomingCallInfo, acceptCall, rejectCall, cancelCall, endCall } = useWebRTC();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

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

  // ----- Outgoing: calling state (full‑screen) -----
  if (callStatus === 'calling') {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Local video preview (full screen) */}
        <video ref={localVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        {/* Dark overlay + "Calling..." + cancel button */}
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
          <div className="text-white text-2xl font-semibold mb-6">Calling...</div>
          <button onClick={cancelCall} className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition">
            <PhoneOff size={28} />
          </button>
        </div>
      </div>
    );
  }

  // ----- Incoming call popup (Messenger style) -----
  if (callStatus === 'incoming' && incomingCallInfo) {
    const callerName = incomingCallInfo.callerId.slice(0, 6);
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
        <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden border border-gray-200">
          <div className="flex items-center gap-3 p-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-bold">
              {callerName[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{callerName}</p>
              <p className="text-sm text-gray-500">Incoming {incomingCallInfo.isVideo ? 'video' : 'audio'} call...</p>
            </div>
          </div>
          <div className="flex border-t border-gray-100">
            <button onClick={() => acceptCall(incomingCallInfo.callId, incomingCallInfo.isVideo)} className="flex-1 py-3 flex items-center justify-center gap-2 text-green-600 font-medium hover:bg-green-50">
              <Phone size={18} /> Accept
            </button>
            <button onClick={() => rejectCall(incomingCallInfo.callId)} className="flex-1 py-3 flex items-center justify-center gap-2 text-red-600 font-medium hover:bg-red-50 border-l border-gray-100">
              <X size={18} /> Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Connected call: full‑screen remote video + local PIP -----
  if (callStatus === 'connected' && remoteStream) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Remote video (main) */}
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        {/* Local video (PIP) */}
        <div className="absolute bottom-6 right-6 w-36 h-48 bg-black rounded-xl overflow-hidden shadow-xl border-2 border-white/30 z-10">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        </div>
        {/* Controls */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6 z-20">
          <button onClick={() => {
            const audioTrack = localStream?.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
          }} className="p-4 rounded-full bg-gray-800/80 hover:bg-gray-700 transition text-white backdrop-blur-sm">
            <Mic size={24} />
          </button>
          <button onClick={() => {
            const videoTrack = localStream?.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
          }} className="p-4 rounded-full bg-gray-800/80 hover:bg-gray-700 transition text-white backdrop-blur-sm">
            <Video size={24} />
          </button>
          <button onClick={endCall} className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition text-white shadow-lg">
            <PhoneOff size={24} />
          </button>
        </div>
        {/* Optional caller name */}
        <div className="absolute top-6 left-6 text-white text-lg font-semibold bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
          {incomingCallInfo?.callerId?.slice(0, 6) || 'Call'}
        </div>
      </div>
    );
  }

  return null;
}
// src\components\CallModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '../contexts/CallContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

export default function CallModal() {
  const { incomingCall, acceptCall, rejectCall, endCall, isInCall, localStream, remoteStream } = useCall();
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callType, setCallType] = useState<'video' | 'audio'>('video');

  // When localStream changes, attach to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      // Detect if video track exists
      const hasVideo = localStream.getVideoTracks().length > 0;
      setCallType(hasVideo ? 'video' : 'audio');
    }
  }, [localStream]);

  // When remoteStream changes, attach to video element
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

  const handleAcceptCall = async () => {
    // Ask for user media when accepting
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    acceptCall(stream);
  };

  // If no active call and no incoming call, don't render
  if (!isInCall && !incomingCall) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div className="relative w-full max-w-4xl bg-gray-900 rounded-lg overflow-hidden">
        {/* Remote video full background */}
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

        {/* Local video (picture-in-picture) */}
        <div className="absolute bottom-4 right-4 w-32 h-48 bg-black rounded-lg overflow-hidden shadow-lg border-2 border-white">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        </div>

        {/* Controls (only when in call) */}
        {isInCall && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
            <button onClick={toggleAudio} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white">
              {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            {callType === 'video' && (
              <button onClick={toggleVideo} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white">
                {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
              </button>
            )}
            <button onClick={endCall} className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white">
              <PhoneOff size={24} />
            </button>
          </div>
        )}

        {/* Incoming call overlay */}
        {incomingCall && !isInCall && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center">
            <p className="text-white text-xl mb-6">Incoming call...</p>
            <div className="flex gap-4">
              <button onClick={handleAcceptCall} className="px-6 py-2 bg-green-600 rounded-full text-white">Accept</button>
              <button onClick={rejectCall} className="px-6 py-2 bg-red-600 rounded-full text-white">Decline</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
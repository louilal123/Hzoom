// src/components/PreCallModal.tsx
import { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';

interface PreCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCall: (withVideo: boolean, withAudio: boolean) => void;
  isVideoCall: boolean; // true = video call, false = audio call
}

export default function PreCallModal({ isOpen, onClose, onStartCall, isVideoCall }: PreCallModalProps) {
  const [withVideo, setWithVideo] = useState(isVideoCall);
  const [withAudio, setWithAudio] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const constraints = { video: withVideo, audio: withAudio };
    navigator.mediaDevices.getUserMedia(constraints)
      .then(s => {
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(err => console.error('Preview error:', err));
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, withVideo, withAudio]);

  const handleStart = () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    onStartCall(withVideo, withAudio);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl w-96 max-w-full p-4 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">{isVideoCall ? 'Video call' : 'Audio call'}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        {isVideoCall && (
          <div className="bg-black rounded-xl overflow-hidden mb-3">
            <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-video object-cover" />
          </div>
        )}
        <div className="flex justify-center gap-4 mb-4">
          {isVideoCall && (
            <button
              onClick={() => setWithVideo(v => !v)}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
            >
              {withVideo ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          )}
          <button
            onClick={() => setWithAudio(v => !v)}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
          >
            {withAudio ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        </div>
        <button
          onClick={handleStart}
          className="w-full py-2 bg-blue-500 text-white rounded-full flex items-center justify-center gap-2 hover:bg-blue-600 transition"
        >
          <Phone size={16} /> Start call
        </button>
      </div>
    </div>
  );
}
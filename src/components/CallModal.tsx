// src/components/CallModal.tsx
import { useEffect } from 'react';
import { useWebRTC } from '../contexts/WebRTCContext';
import { X, Phone } from 'lucide-react';
import { updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function CallModal() {
  const { incomingCallInfo, clearIncomingCall } = useWebRTC();

  // Auto-remove popup if the call status becomes 'ended' (e.g., caller cancelled)
  useEffect(() => {
    if (!incomingCallInfo) return;
    const callRef = doc(db, 'calls', incomingCallInfo.callId);
    const unsubscribe = onSnapshot(callRef, (snap) => {
      const data = snap.data();
      if (data?.status === 'ended') {
        clearIncomingCall();
      }
    });
    return () => unsubscribe();
  }, [incomingCallInfo, clearIncomingCall]);

  const handleAccept = async () => {
    if (incomingCallInfo) {
      const { callId, callerId, isVideo } = incomingCallInfo;
      // Change status to 'ringing' so main window stops showing the popup
      await updateDoc(doc(db, 'calls', callId), { status: 'ringing' });
      window.open(
        `/call?callId=${callId}&receiverId=${callerId}&isVideo=${isVideo}`,
        '_blank',
        'width=800,height=600,popup=1'
      );
      clearIncomingCall();
    }
  };

  const handleReject = async () => {
    if (incomingCallInfo) {
      await updateDoc(doc(db, 'calls', incomingCallInfo.callId), { status: 'ended' });
      clearIncomingCall();
    }
  };

  if (!incomingCallInfo) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden border border-gray-200">
        <div className="flex items-center gap-3 p-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-bold">
            {incomingCallInfo.callerName[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{incomingCallInfo.callerName}</p>
            <p className="text-sm text-gray-500">Incoming {incomingCallInfo.isVideo ? 'video' : 'audio'} call...</p>
          </div>
        </div>
        <div className="flex border-t border-gray-100">
          <button onClick={handleAccept} className="flex-1 py-3 flex items-center justify-center gap-2 text-green-600 font-medium hover:bg-green-50">
            <Phone size={18} /> Accept
          </button>
          <button onClick={handleReject} className="flex-1 py-3 flex items-center justify-center gap-2 text-red-600 font-medium hover:bg-red-50 border-l border-gray-100">
            <X size={18} /> Decline
          </button>
        </div>
      </div>
    </div>
  );
}
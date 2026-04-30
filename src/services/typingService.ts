import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function setTypingStatus(convId: string, userId: string) {
    const typingRef = doc(db, 'conversations', convId, 'typing', userId);
    return setDoc(typingRef, {
        lastTyped: serverTimestamp(),
        typing: true,  // field kept for clarity, but not strictly needed
    }, { merge: true }).catch(console.error);
}

export async function clearTypingStatus(convId: string, userId: string) {
    const typingRef = doc(db, 'conversations', convId, 'typing', userId);
    return setDoc(typingRef, {
        lastTyped: serverTimestamp(),
        typing: false,
    }, { merge: true }).catch(console.error);
}
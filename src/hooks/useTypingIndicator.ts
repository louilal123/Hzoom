import { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const TYPING_THRESHOLD_MS = 5_000; // fallback timeout

export function useTypingIndicator(convId: string, otherUserId: string) {
    const [isTyping, setIsTyping] = useState(false);
    const timeoutRef = useRef<number | undefined>(undefined); // ✅ fixed

    useEffect(() => {
        if (!convId || !otherUserId) {
            setIsTyping(false);
            return;
        }

        const typingRef = doc(db, 'conversations', convId, 'typing', otherUserId);
        const unsubscribe = onSnapshot(typingRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();

                if (data.typing === false) {
                    setIsTyping(false);
                    if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current);
                        timeoutRef.current = undefined;
                    }
                    return;
                }

                const lastTyped = data.lastTyped?.toDate();
                if (lastTyped) {
                    const diff = Date.now() - lastTyped.getTime();
                    if (diff < TYPING_THRESHOLD_MS) {
                        setIsTyping(true);
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        timeoutRef.current = window.setTimeout(() => {
                            setIsTyping(false);
                        }, TYPING_THRESHOLD_MS - diff);
                    } else {
                        setIsTyping(false);
                    }
                }
            } else {
                setIsTyping(false);
            }
        }, (error) => {
            console.error('Typing indicator listener error:', error);
            setIsTyping(false);
        });

        return () => {
            unsubscribe();
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = undefined;
            }
        };
    }, [convId, otherUserId]);

    return isTyping;
}
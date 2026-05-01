// src\hooks\useUserPresence.ts
import { useEffect, useState } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const ONLINE_THRESHOLD_MS = 15_000; // 15 seconds

function timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
}

export function useUserPresence(uid: string | undefined) {
    const [lastSeen, setLastSeen] = useState<Timestamp | null>(null);

    useEffect(() => {
        if (!uid) {
            setLastSeen(null);
            return;
        }

        const docRef = doc(db, 'presence', uid);
        const unsub = onSnapshot(
            docRef,
            (snap) => {
                if (snap.exists()) {
                    setLastSeen(snap.data().lastSeen ?? null);
                } else {
                    setLastSeen(null);
                }
            },
            (error) => {
                console.error('Presence listener error:', error);
                setLastSeen(null);
            }
        );

        return unsub;
    }, [uid]);

    const online = lastSeen
        ? Date.now() - lastSeen.toDate().getTime() < ONLINE_THRESHOLD_MS
        : false;

    const lastSeenText = lastSeen
        ? online
            ? 'Online now'
            : `Active ${timeAgo(lastSeen.toDate())}`
        : 'Offline';

    return { online, lastSeenText };
}
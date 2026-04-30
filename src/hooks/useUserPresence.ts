import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const ONLINE_THRESHOLD_MS = 15_000; // 15 seconds
const POLL_INTERVAL_MS = 15_000;

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
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        if (!uid) return;

        let timer: ReturnType<typeof setInterval>;

        const fetchPresence = async () => {
            try {
                const snap = await getDoc(doc(db, 'presence', uid));
                if (snap.exists() && mountedRef.current) {
                    setLastSeen(snap.data().lastSeen ?? null);
                } else if (mountedRef.current) {
                    setLastSeen(null);
                }
            } catch (error) {
                console.error('Presence fetch error:', error);
            }
        };

        // Fetch immediately and then poll
        fetchPresence();
        timer = setInterval(fetchPresence, POLL_INTERVAL_MS);

        return () => {
            mountedRef.current = false;
            clearInterval(timer);
        };
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
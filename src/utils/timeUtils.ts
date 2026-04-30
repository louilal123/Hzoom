// src/utils/timeUtils.ts

const ONLINE_THRESHOLD_MS = 15 * 1000; // 15 seconds

/**
 * Returns true if the given date is within the threshold from now.
 */
export function isOnline(date: Date): boolean {
    return Date.now() - date.getTime() < ONLINE_THRESHOLD_MS;
}

/**
 * Returns a human-readable relative time string, e.g. "2 min", "30 sec", "1 hr".
 */
export function timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${Math.max(seconds, 0)}s`;
}
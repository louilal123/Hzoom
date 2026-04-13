// src/utils/username.ts

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const generateUsername = async (base: string): Promise<string> => {
    // Remove special characters, spaces, and convert to lowercase
    let clean = base
        .split('@')[0]                     // take part before @ if email
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    if (clean.length < 3) clean = clean + 'user'; // fallback

    let username = clean;
    let exists = true;
    let counter = 1;

    while (exists) {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            exists = false;
        } else {
            username = `${clean}${counter}`;
            counter++;
        }
    }
    return username;
};
// src\services\chatService.ts
import { db, auth } from '../config/firebase';
import {
    collection,
    doc,
    setDoc,
    updateDoc,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    getDocs,
    getDoc,
    Timestamp,
} from 'firebase/firestore';

export interface Message {
    id?: string;
    text: string;
    senderId: string;
    timestamp: Date;
    read: boolean;
}

export interface Conversation {
    id: string;
    participants: string[];
    lastMessage: string;
    lastMessageTime: Date;
    updatedAt: Date;
}

// Get or create a conversation between two users
export const getOrCreateConversation = async (otherUserId: string): Promise<string> => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) throw new Error('Not authenticated');

    // Check if conversation already exists
    const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUserId)
    );
    const snapshot = await getDocs(q);
    const existing = snapshot.docs.find(doc => {
        const participants = doc.data().participants;
        return participants.length === 2 && participants.includes(otherUserId);
    });
    if (existing) return existing.id;

    // Create new conversation
    const newConvRef = doc(collection(db, 'conversations'));
    await setDoc(newConvRef, {
        participants: [currentUserId, otherUserId],
        lastMessage: '',
        lastMessageTime: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return newConvRef.id;
};

// Send a message to a conversation
export const sendMessage = async (conversationId: string, text: string) => {
    const senderId = auth.currentUser?.uid;
    if (!senderId) throw new Error('Not authenticated');

    const message = {
        text,
        senderId,
        timestamp: Timestamp.now(),
        read: false,
    };
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), message);

    // Update conversation's last message and time
    await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: text,
        lastMessageTime: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
};

// Listen to messages in a conversation (real-time)
export const listenToMessages = (
    conversationId: string,
    callback: (messages: Message[]) => void
) => {
    const q = query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate(),
        })) as Message[];
        callback(messages);
    });
};

// Listen to all conversations for the current user (real-time)
export const listenToConversations = (callback: (conversations: Conversation[]) => void) => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return () => { };

    const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUserId),
        orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
        const convs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            lastMessageTime: doc.data().lastMessageTime?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        })) as Conversation[];
        callback(convs);
    });
};

// Get user details by ID (for contact names)
export const getUser = async (userId: string) => {
    const docSnap = await getDoc(doc(db, 'users', userId));
    return docSnap.exists() ? docSnap.data() : null;
};
//search users to enable chatting with users usng email
// searchUsers – by email or name (case‑insensitive)
export const searchUsers = async (searchTerm: string) => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId || !searchTerm.trim()) return [];

    const lowerTerm = searchTerm.toLowerCase();

    // Query by emailLower
    const emailQuery = query(
        collection(db, 'users'),
        where('emailLower', '>=', lowerTerm),
        where('emailLower', '<=', lowerTerm + '\uf8ff')
    );

    // Query by nameLower (you may also need to add this field to user docs)
    const nameQuery = query(
        collection(db, 'users'),
        where('nameLower', '>=', lowerTerm),
        where('nameLower', '<=', lowerTerm + '\uf8ff')
    );

    const [emailSnapshot, nameSnapshot] = await Promise.all([
        getDocs(emailQuery),
        getDocs(nameQuery),
    ]);

    const emailResults = emailSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const nameResults = nameSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Combine and deduplicate by user id
    const combined = [...emailResults, ...nameResults];
    const unique = combined.filter((user, index, self) =>
        index === self.findIndex(u => u.id === user.id)
    );

    return unique.filter(user => user.id !== currentUserId);
};
// src/config/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCCdr_tJGu4dPP6jyvEp_IJymESZQhm6rI",
    authDomain: "hzoom-8e84e.firebaseapp.com",
    projectId: "hzoom-8e84e",
    storageBucket: "hzoom-8e84e.firebasestorage.app",
    messagingSenderId: "966844975654",
    appId: "1:966844975654:web:a0e6fdbb54f0688799b4e7",
    measurementId: "G-QT5QWTT8Z0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

export default app;
// src/pages/Login.tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import { generateUsername } from '../utils/username';

function Login() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const navigate = useNavigate();

  const saveUserToFirestore = async (user: any, authProvider: 'email' | 'google', isNewUser = true) => {
    const userRef = doc(db, 'users', user.uid);
    const data: any = {
      email: user.email,
      emailLower: user.email.toLowerCase(),
      name: user.displayName || '',
      nameLower: (user.displayName || '').toLowerCase(),
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      role: 'user',
      authProvider,
    };

    if (isNewUser) {
      const base = user.displayName || user.email;
      data.username = await generateUsername(base);
    }

    await setDoc(userRef, data, { merge: true });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
          await saveUserToFirestore(userCredential.user, 'email');
        } else {
          throw err;
        }
      }

      const userRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userRef, { lastLogin: new Date().toISOString() }, { merge: true });

      navigate('/messages');
    } catch (err: any) {
      console.error(err);
      switch (err.code) {
        case 'auth/invalid-email':
          setError('Invalid email address format.');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password.');
          break;
        case 'auth/weak-password':
          setError('Password must be at least 6 characters.');
          break;
        case 'auth/email-already-in-use':
          setError('An account already exists with this email.');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.');
          break;
        default:
          setError('Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

    const handleGoogleSignIn = async () => {
      setLoading(true);
      setError('');

      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        console.log("1. Starting Google sign-in popup");
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log("2. Google sign-in success:", user.email);

        const hasEmailPassword = user.providerData.some(
          (p: any) => p.providerId === 'password'
        );
        console.log("3. Has email/password linked?", hasEmailPassword);

       if (!hasEmailPassword) {
          // Pass only serializable data (UID and email)
          navigate('/set-password', { state: { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL } });
          return;
        }

        console.log("5. Existing user – saving to Firestore and redirecting to home");
        await saveUserToFirestore(user, 'google');
        navigate('/messages');
      } catch (err: any) {
        console.error("Google sign-in error details:", err);
        setError(`Google sign‑in failed: ${err.message || 'Please try again.'}`);
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center border-0 shadow-none ring-0 outline-none">
      <div className="w-full max-w-xs border-0 shadow-none ring-0 outline-none">
        <div className="bg-white-100">
          <div className="text-center mb-6">
           <div className=" text-4xl font-bold py-4 px-2">
            <span className="bg-gradient-to-r from-gray-500 to-gray-700 bg-clip-text text-transparent drop-shadow-sm">
              hzoom
            </span>
          </div>
            <p className="text-sm text-gray-500 mt-4">Sign in to continue</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-xs">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-transparent transition text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-transparent transition text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Please wait...' : 'Sign In'}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-gray-400">or</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full cursor-pointer py-3 px-4 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-sm shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-xs text-gray-400 mt-5">
            By continuing, you agree to our Terms
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
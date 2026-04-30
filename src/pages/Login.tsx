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
  const [showPassword, setShowPassword] = useState<boolean>(false); // New state

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
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      {/* Left Column - Banner with Image */}
      <div className="relative w-full md:w-1/2 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
          alt="Team collaboration workspace"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 via-purple-900/70 to-pink-800/60" />
        
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white p-8 text-center">
          <div className="max-w-md">
            <div className="text-5xl font-bold mb-6 tracking-tight drop-shadow-lg">
              hzoom
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">Connect with ease</h2>
            <p className="text-white/90 text-md md:text-lg">
              Experience seamless team collaboration, messaging, and file sharing — all in one place.
            </p>
            <div className="mt-8 flex justify-center gap-2">
              <div className="w-2 h-2 bg-white/60 rounded-full"></div>
              <div className="w-2 h-2 bg-white/30 rounded-full"></div>
              <div className="w-2 h-2 bg-white/30 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-lg p-8 transition-all duration-300">
            <div className="text-center mb-8">
              <div className="text-3xl font-bold py-2">
                <span className="bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  Welcome Back
                </span>
              </div>
              <p className="text-gray-500 mt-3 text-sm">Sign in using your credentials</p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-50 rounded-xl border-0">
                <p className="text-red-600 text-xs">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:bg-white transition-all text-sm border-0"
              />
              
              {/* Password field with eye toggle */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:bg-white transition-all text-sm border-0 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    // Eye open icon (visible)
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    // Eye closed icon (hidden)
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m-3.65 3.65l3.65-3.65" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 01-3 3m0-6a3 3 0 013 3" />
                    </svg>
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
              >
                {loading ? 'Please wait...' : 'Sign In'}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-gray-400">or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full cursor-pointer py-3 px-4 bg-white border-0 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-sm shadow-sm ring-1 ring-gray-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-xs text-gray-400 mt-6">
              By continuing, you agree to our Terms of Service
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
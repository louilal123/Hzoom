// src/pages/SetPassword.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EmailAuthProvider, linkWithCredential, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { generateUsername } from '../utils/username';

function SetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { uid, email, displayName } = location.state || {};
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.uid === uid) {
        setCurrentUser(user);
      } else if (!user) {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [uid, navigate]);

  if (!uid || !email) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!currentUser) {
        throw new Error('User not authenticated – please wait a moment');
      }
      const credential = EmailAuthProvider.credential(email, newPassword);
      await linkWithCredential(currentUser, credential);

      const userRef = doc(db, 'users', currentUser.uid);
      const base = displayName || email;
      const username = await generateUsername(base);
      await setDoc(
        userRef,
        {
          email,
          emailLower: email.toLowerCase(),
          name: displayName || '',
          nameLower: (displayName || '').toLowerCase(),
          username,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          role: 'user',
          authProvider: 'google',
        },
        { merge: true }
      );

      navigate('/messages');
    } catch (err: any) {
      console.error(err);
      setError(`Failed: ${err.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      {/* Left column - Illustration */}
      <div className="relative w-full md:w-1/2 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1614741115687-0cc4a5a2c5b8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
          alt="Create a secure password"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-indigo-900/70 to-purple-800/60" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white p-8 text-center">
          <div className="max-w-md">
            <div className="text-5xl font-bold mb-6 tracking-tight drop-shadow-lg">hzoom</div>
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">Secure your account</h2>
            <p className="text-white/90 text-md md:text-lg">
              Set a password to enable email sign‑in. You can always use Google to log in later.
            </p>
            <div className="mt-8 flex justify-center gap-2">
              <div className="w-2 h-2 bg-white/60 rounded-full"></div>
              <div className="w-2 h-2 bg-white/30 rounded-full"></div>
              <div className="w-2 h-2 bg-white/30 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Right column - Password form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-lg p-8 transition-all duration-300">
            <div className="text-center mb-8">
              <div className="text-3xl font-bold py-2">
                <span className="bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  Set your password
                </span>
              </div>
              <p className="text-gray-500 mt-3 text-sm">Almost there — just one more step</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New password field */}
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:bg-white transition-all text-sm border-0 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m-3.65 3.65l3.65-3.65" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 01-3 3m0-6a3 3 0 013 3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Confirm password field */}
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:bg-white transition-all text-sm border-0 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m-3.65 3.65l3.65-3.65" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 01-3 3m0-6a3 3 0 013 3" />
                    </svg>
                  )}
                </button>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
              >
                {loading ? 'Please wait...' : 'Save password'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/messages')}
                className="w-full cursor-pointer py-3 px-4 bg-white border-0 text-gray-500 font-medium rounded-xl hover:bg-gray-50 transition text-sm shadow-sm ring-1 ring-gray-200"
              >
                Skip for now
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              You can always sign in with Google later
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetPassword;
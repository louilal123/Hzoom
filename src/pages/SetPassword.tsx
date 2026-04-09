import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EmailAuthProvider, linkWithCredential, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';

function SetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { uid, email, displayName, photoURL } = location.state || {};
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Get the currently signed-in user (from Google)
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
        console.log('Current user UID:', currentUser.uid);
        console.log('Email from location:', email);
        const credential = EmailAuthProvider.credential(email, newPassword);
        await linkWithCredential(currentUser, credential);
        console.log('Password linked successfully');

        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(
        userRef,
        {
            email,
            name: displayName || '',
            photoURL: photoURL || '',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            role: 'user',
            authProvider: 'google',
        },
        { merge: true }
        );

        navigate('/home');
    } catch (err: any) {
        console.error('LINKING ERROR FULL OBJECT:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        // Show the actual Firebase error message to the user temporarily for debugging
        setError(`Failed: ${err.message || 'Please try again.'}`);
    } finally {
        setLoading(false);
    }
    };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Set a password</h1>
        <p className="text-gray-500 mb-6">
          You are one step away from creating an account. Create a password to also sign in with email.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200"
            required
            minLength={6}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition"
          >
            {loading ? 'Please wait...' : 'Save password'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="w-full text-gray-500 hover:text-gray-700 text-sm"
          >
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}

export default SetPassword;
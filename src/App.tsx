import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WebRTCProvider } from './contexts/WebRTCContext';
import { AuthProvider } from './contexts/AuthContext';
import CallModal from './components/CallModal';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import Layout from './components/layout/Layout';
import MessagesPage from './pages/MessagesPage';
import SettingsPage from './pages/SettingsPage';
import GroupsPage from './pages/GroupsPage';
import CallPage from './pages/CallPage';
import AuthGuard from './components/AuthGuard';
import PublicRoute from './components/PublicRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <WebRTCProvider>
          <Routes>
            {/* Public routes – redirect to /messages if already authenticated */}
            <Route element={<PublicRoute />}>
              <Route path="/" element={<Login />} />
              <Route path="/set-password" element={<SetPassword />} />
            </Route>

            {/* Protected routes without sidebar */}
            <Route element={<AuthGuard />}>
              <Route path="/call" element={<CallPage />} />
            </Route>

            {/* Routes with sidebar (Layout) */}
            <Route element={<Layout />}>
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/:conversationId" element={<MessagesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/group-chats" element={<GroupsPage />} />
            </Route>
          </Routes>
          <CallModal />
        </WebRTCProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
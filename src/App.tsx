import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WebRTCProvider } from './contexts/WebRTCContext';
import CallModal from './components/CallModal';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import Layout from './components/Layout';
import MessagesPage from './pages/MessagesPage';
import SettingsPage from './pages/SettingsPage';
import GroupsPage from './pages/GroupsPage';
import CallPage from './pages/CallPage';
import AuthGuard from './components/AuthGuard';
function App() {
  return (
     <WebRTCProvider>
      <Router>
     <Routes>
  <Route path="/" element={<Login />} />
  <Route path="/set-password" element={<SetPassword />} />
  
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
      </Router>
      <CallModal />
    </WebRTCProvider>
  );
}

export default App;
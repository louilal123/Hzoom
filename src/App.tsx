import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CallProvider } from './contexts/CallContext';
import CallModal from './components/CallModal';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import Layout from './components/Layout';
import MessagesPage from './pages/MessagesPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <CallProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route element={<Layout />}>
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<MessagesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
      <CallModal />
    </CallProvider>
  );
}

export default App;
// src/pages/Home.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth,db } from '../config/firebase'
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  MessageCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Video,
  Phone,
  Search,
  Send,
  MoreHorizontal,
  CameraOff
} from 'lucide-react';
import logo from '../assets/hzoom_logo.png';
import './../index.css'

interface Contact {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  messages: { text: string; sent: boolean; time: string; system?: boolean; icon?: React.ReactNode }[];
}

function Home() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messageInput, setMessageInput] = useState('');

  // Static contacts with example messages
  const contacts: Contact[] = [
    {
      id: 'hazel',
      name: 'Hazel Medalla',
      avatar: 'HM',
      lastMessage: 'Video chat ended',
      lastMessageTime: '11:05 AM',
      messages: [
        { text: 'Hey! How are you?', sent: false, time: '10:30 AM' },
        { text: 'I’m good, thanks! Working on the HZoom project.', sent: true, time: '10:32 AM' },
        { text: 'Sounds exciting! Need any help?', sent: false, time: '10:35 AM' },
        { text: 'Maybe with testing the video call feature later?', sent: true, time: '10:38 AM' },
        { text: 'Sure, just send me the link.', sent: false, time: '10:42 AM' },
        {
          text: 'Video chat ended',
          sent: false,
          time: '11:05 AM',
          system: true,
          icon: <CameraOff size={12} className="inline mr-1" />
        }
      ]
    },
    {
      id: 'mama',
      name: 'Mama',
      avatar: 'M',
      lastMessage: 'I love you, anak.',
      lastMessageTime: 'Yesterday',
      messages: [
        { text: 'Good morning, anak! Kamusta?', sent: false, time: '8:15 AM' },
        { text: 'Good morning, Ma! Okay lang, busy sa work.', sent: true, time: '8:20 AM' },
        { text: 'Wag pabayaan ang health ha?', sent: false, time: '8:22 AM' },
        { text: 'Opo, Ma. Kayo din po.', sent: true, time: '8:25 AM' },
        { text: 'I love you, anak.', sent: false, time: '8:26 AM' }
      ]
    }
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/');
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedContact) return;
    console.log(`Sending to ${selectedContact.name}: ${messageInput}`);
    setMessageInput('');
  };

  const startVideoCall = (contact: Contact) => {
    console.log(`Starting video call with ${contact.name}`);
    alert(`Starting video call with ${contact.name}...`);
  };

  const navItems = [
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  const user = auth.currentUser;

  // Sidebar component
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      <div className="flex justify-center py-8">
        <img src={logo} alt="HZoom Logo" className="h-12 w-auto" />
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-blue-50 text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-blue-500'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium shadow-sm">
            {userData?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 truncate">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {userData?.name || user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );

  // Messages view
  const MessagesView = () => (
    <div className="flex h-full">
      {/* Contacts sidebar */}
      <div className="w-80 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="relative shadow-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search conversations"
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
                selectedContact?.id === contact.id
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : 'hover:bg-gray-50 border-l-4 border-transparent'
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                {contact.avatar}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-800">{contact.name}</p>
                <p className="text-xs text-gray-500 truncate">{contact.lastMessage}</p>
              </div>
              <div className="text-xs text-gray-400">{contact.lastMessageTime}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedContact ? (
          <>
            {/* Chat header with call buttons */}
            <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                  {selectedContact.avatar}
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-800">{selectedContact.name}</p>
                  <p className="text-xs text-green-500">Online</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startVideoCall(selectedContact)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition"
                  title="Video call"
                >
                  <Video size={20} />
                </button>
                <button
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition"
                  title="Voice call"
                >
                  <Phone size={20} />
                </button>
                <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition">
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>

            {/* Messages area with improved bubbles */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {selectedContact.messages.map((msg, idx) => (
                <div key={idx}>
                  {msg.system ? (
                    <div className="flex justify-center">
                      <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full shadow-sm">
                        {msg.icon}
                        <span>{msg.text}</span>
                        <span className="ml-1 text-gray-400">{msg.time}</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] px-4 py-2.5 text-sm shadow-sm ${
                          msg.sent
                            ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
                            : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200'
                        }`}
                      >
                        {msg.text}
                        <div className={`text-[10px] mt-1 ${msg.sent ? 'text-blue-100' : 'text-gray-400'}`}>
                          {msg.time}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Message input */}
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  onClick={handleSendMessage}
                  className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition shadow-md"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );

  // Settings view (placeholder)
  const SettingsView = () => (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Settings</h1>
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Account</h2>
          <div className="space-y-2 text-sm">
            <p className="text-gray-600"><span className="font-medium">Email:</span> {user?.email}</p>
            <p className="text-gray-600"><span className="font-medium">Name:</span> {userData?.name || 'Not set'}</p>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">Edit profile →</button>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Preferences</h2>
          <p className="text-sm text-gray-500">More options coming soon.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-white rounded-full shadow-md border border-gray-100"
        >
          {sidebarOpen ? <X size={20} className="text-gray-600" /> : <Menu size={20} className="text-gray-600" />}
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:block fixed left-0 top-0 h-full w-64 z-40 shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-white z-50 transform transition-transform duration-200 shadow-xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </div>

      {/* Main content */}
      <main className="md:ml-64 h-screen">
        {activeTab === 'messages' && <MessagesView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

export default Home;
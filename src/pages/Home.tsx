import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  MessageCircle, Settings, LogOut, Menu, X, Video, Search, Send, MoreHorizontal, Phone, ChevronLeft
} from 'lucide-react';
import logo from '../assets/hzoom_logo.png';
import {
  listenToConversations,
  listenToMessages,
  sendMessage,
  getUser,
} from '../services/chatService';

import type { Conversation, Message } from '../services/chatService';
function Home() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [contactNames, setContactNames] = useState<Record<string, string>>({});

  const user = auth.currentUser;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/');
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) setUserData(userDoc.data());
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [navigate]);

  // Real-time conversations
  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToConversations(async (convs) => {
      setConversations(convs);
      // Fetch names for other participants
      for (const conv of convs) {
        const otherId = conv.participants.find(id => id !== user.uid);
        if (otherId && !contactNames[otherId]) {
          const otherUser = await getUser(otherId);
          if (otherUser) {
            setContactNames(prev => ({ ...prev, [otherId]: otherUser.name || otherUser.email }));
          }
        }
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Real-time messages when a conversation is selected
  useEffect(() => {
    if (!selectedConv) return;
    const unsubscribe = listenToMessages(selectedConv.id, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [selectedConv]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedConv) return;
    await sendMessage(selectedConv.id, messageInput);
    setMessageInput('');
  };

  const startVideoCall = (conv: Conversation) => {
    const otherId = conv.participants.find(id => id !== user?.uid);
    alert(`Video call with ${contactNames[otherId!] || otherId} – coming soon!`);
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      <div className="flex justify-center py-8"><img src={logo} alt="HZoom Logo" className="h-12 w-auto" /></div>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === item.id ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-500'}`}>
              <Icon size={18} /><span>{item.label}</span>
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
            <p className="text-sm font-semibold text-gray-800 truncate">{userData?.name || user?.email?.split('@')[0]}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );

  // Responsive Messages view
  const MessagesView = () => {
    const [showChat, setShowChat] = useState(false);

    const handleSelectConversation = (conv: Conversation) => {
      setSelectedConv(conv);
      setShowChat(true);
    };

    const handleBackToList = () => {
      setShowChat(false);
      setSelectedConv(null);
    };

    return (
      <div className="flex h-full">
        {/* Conversations list – hidden on mobile when chat is open */}
        <div className={`w-full md:w-80 bg-white border-r border-gray-100 flex flex-col ${showChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100">
            <div className="relative shadow-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Search conversations" className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => {
              const otherId = conv.participants.find(id => id !== user?.uid);
              const displayName = contactNames[otherId!] || otherId?.slice(0, 6) || 'Unknown';
              return (
                <button key={conv.id} onClick={() => handleSelectConversation(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${selectedConv?.id === conv.id && showChat ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                    {displayName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-gray-800">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{conv.lastMessage || 'Start a conversation'}</p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {conv.lastMessageTime ? new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </button>
              );
            })}
            {conversations.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8">No conversations yet. Find users to chat with.</div>
            )}
          </div>
        </div>

        {/* Chat area – full width on mobile when active */}
        <div className={`flex-1 flex flex-col bg-gray-50 ${!showChat ? 'hidden md:flex' : 'flex'}`}>
          {selectedConv ? (
            <>
              {/* Chat header with back button for mobile */}
              <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <button onClick={handleBackToList} className="md:hidden p-1 -ml-2 text-gray-600">
                    <ChevronLeft size={24} />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                    {(() => {
                      const otherId = selectedConv.participants.find(id => id !== user?.uid);
                      const name = contactNames[otherId!] || otherId || '';
                      return name[0]?.toUpperCase() || '?';
                    })()}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-800">
                      {(() => {
                        const otherId = selectedConv.participants.find(id => id !== user?.uid);
                        return contactNames[otherId!] || otherId || 'Unknown';
                      })()}
                    </p>
                    <p className="text-xs text-green-500">Online</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startVideoCall(selectedConv)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition"><Video size={20} /></button>
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition"><Phone size={20} /></button>
                  <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition"><MoreHorizontal size={20} /></button>
                </div>
              </div>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2.5 text-sm shadow-sm ${msg.senderId === user?.uid ? 'bg-blue-500 text-white rounded-2xl rounded-br-md' : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200'}`}>
                      {msg.text}
                      <div className={`text-[10px] mt-1 ${msg.senderId === user?.uid ? 'text-blue-100' : 'text-gray-400'}`}>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && <div className="flex justify-center text-gray-400 text-sm">No messages yet. Say hello!</div>}
              </div>
              {/* Message input */}
              <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex gap-2">
                  <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Type a message..." className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
                  <button onClick={handleSend} className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition shadow-md"><Send size={18} /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a conversation to start messaging</div>
          )}
        </div>
      </div>
    );
  };

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
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 bg-white rounded-full shadow-md border border-gray-100">
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
        {activeTab === 'messages' ? <MessagesView /> : <SettingsView />}
      </main>
    </div>
  );
}

export default Home;
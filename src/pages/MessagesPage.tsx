import { useEffect, useState, memo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  listenToConversations,
  listenToMessages,
  sendMessage,
  getUser,
  getOrCreateConversation,
} from '../services/chatService';
import type { Conversation, Message } from '../services/chatService';
import { Search, Send, Video, Phone, MoreHorizontal, ChevronLeft } from 'lucide-react';


//  Memoized search input component to prevent focus loss
const SearchInput = memo(({ value, onChange }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => {
  // Keep a ref to the input to ensure it exists
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus once on mount (optional, but ensures it's ready)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  

  return (
    <div className="relative shadow-sm">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search by name, email..."
        value={value}
        onChange={onChange}
        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300"
      />
    </div>
  );
});

export default function MessagesPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [contactNames, setContactNames] = useState<Record<string, string>>({});

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]); // 👈 all users from DB
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Load conversations and listen for real‑time updates
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = listenToConversations(async (convs) => {
      setConversations(convs);
      // Fetch names for participants
      for (const conv of convs) {
        const otherId = conv.participants.find(id => id !== currentUser.uid);
        if (otherId && !contactNames[otherId]) {
          const otherUser = await getUser(otherId);
          if (otherUser) {
            setContactNames(prev => ({ ...prev, [otherId]: otherUser.name || otherUser.email }));
          }
        }
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  //  Fetch all users (except current) once on mount
  useEffect(() => {
    if (!currentUser) return;
    const fetchAllUsers = async () => {
      setLoadingUsers(true);
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = usersSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((user: any) => user.id !== currentUser.uid);
        setAllUsers(users);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchAllUsers();
  }, [currentUser]);

  // When conversationId from URL changes, find the conversation object
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) setSelectedConv(conv);
    } else if (!conversationId) {
      setSelectedConv(null);
    }
  }, [conversationId, conversations]);

  // Listen to messages of the selected conversation
  useEffect(() => {
    if (!selectedConv) return;
    const unsubscribe = listenToMessages(selectedConv.id, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [selectedConv]);

  // But keep the original searchUsers for cases where you want remote search
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedConv) return;
    try {
      await sendMessage(selectedConv.id, messageInput);
      setMessageInput('');
    } catch (error) {
      console.error('Send error:', error);
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    navigate(`/messages/${conv.id}`);
  };

  const handleStartNewChat = async (otherUser: any) => {
    const convId = await getOrCreateConversation(otherUser.id);
    setContactNames(prev => ({ ...prev, [otherUser.id]: otherUser.name || otherUser.email }));
    navigate(`/messages/${convId}`);
    setSearchTerm(''); // clear search after starting chat
  };

  const getConversationDisplayName = (conv: Conversation) => {
    const otherId = conv.participants.find(id => id !== currentUser?.uid);
    return contactNames[otherId!] || otherId?.slice(0, 6) || 'Unknown';
  };

  // Filter existing conversations by search term
  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm.trim()) return true;
    const name = getConversationDisplayName(conv);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  //  Filter all users (excluding those already in a conversation)
  const existingContactIds = new Set(conversations.flatMap(c => c.participants));
  const filteredAllUsers = allUsers.filter(user => {
    if (!searchTerm.trim()) return !existingContactIds.has(user.id);
    const nameMatch = (user.name || user.email).toLowerCase().includes(searchTerm.toLowerCase());
    return !existingContactIds.has(user.id) && nameMatch;
  });

const handleVideoCall = (conv: Conversation) => {
  const otherId = conv.participants.find(id => id !== currentUser?.uid);
  if (otherId) {
    const width = 800;
    const height = 600;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    window.open(
      `/call?receiverId=${otherId}&isVideo=true`,
      '_blank',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );
  }
};

const handleAudioCall = (conv: Conversation) => {
  const otherId = conv.participants.find(id => id !== currentUser?.uid);
  if (otherId) {
    const width = 800;
    const height = 600;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    window.open(
      `/call?receiverId=${otherId}&isVideo=false`,
      '_blank',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );
  }
};

  return (
    <div className="flex h-full">
      {/* Conversation list + All users */}
      <div className="w-full md:w-80 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <SearchInput value={searchTerm} onChange={handleSearchChange} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Existing conversations */}
          {filteredConversations.length > 0 && (
            <>
              <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Conversations
              </div>
              {filteredConversations.map(conv => (
                <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-all cursor-pointer ${
                    selectedConv?.id === conv.id
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
                >
                {/* Avatar – prevent shrinking */}
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {getConversationDisplayName(conv)[0].toUpperCase()}
                </div>
                
                {/* Text container – allow truncation */}
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                    {getConversationDisplayName(conv)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                    {conv.lastMessage || 'Start a conversation'}
                    </p>
                </div>
                
                {/* Time – prevent shrinking */}
                <div className="text-xs text-gray-400 flex-shrink-0">
                    {conv.lastMessageTime
                    ? new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </div>
                </button>
              ))}
            </>
          )}

          {/* All users section */}
          {filteredAllUsers.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-100">
                All users
              </div>
              {filteredAllUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium">
                      {(user.name?.[0] || user.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{user.name || user.email}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartNewChat(user)}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                  >
                    Message
                  </button>
                </div>
              ))}
            </>
          )}

          {loadingUsers && <div className="text-center text-gray-400 text-sm py-4">Loading users...</div>}
          {!loadingUsers && searchTerm && filteredConversations.length === 0 && filteredAllUsers.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">No users or conversations found</div>
          )}
          {!loadingUsers && !searchTerm && conversations.length === 0 && allUsers.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">No other users found</div>
          )}
        </div>
      </div>

      {/* Chat area (unchanged) */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedConv ? (
          <>
            <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate('/messages')} className="md:hidden p-1 -ml-2 text-gray-600">
                  <ChevronLeft size={24} />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium">
                  {getConversationDisplayName(selectedConv)[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-800">{getConversationDisplayName(selectedConv)}</p>
                  <p className="text-xs text-green-500">Online</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleVideoCall(selectedConv)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full">
                  <Video size={20} />
                </button>
                <button  onClick={() => handleAudioCall(selectedConv)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full">
                  <Phone size={20} />
                </button>
                <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-4 py-2.5 text-sm shadow-sm ${
                    msg.senderId === currentUser?.uid
                      ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
                      : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200'
                  }`}>
                    {msg.text}
                    <div className={`text-[10px] mt-1 ${msg.senderId === currentUser?.uid ? 'text-blue-100' : 'text-gray-400'}`}>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && <div className="flex justify-center text-gray-400 text-sm">No messages yet. Say hello!</div>}
            </div>
           <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex items-end gap-2">
                    <textarea
                    value={messageInput}
                    onChange={(e) => {
                        setMessageInput(e.target.value);
                        // Auto-resize
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                        }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 px-4 py-2.5 bg-gray-100 rounded-2xl text-sm focus:outline-none resize-none overflow-y-auto"
                    style={{ minHeight: '42px', maxHeight: '120px' }}
                    />
                    <button 
                    onClick={handleSend} 
                    className="p-2.5 bg-blue-500 text-white rounded-full cursor-pointer  hover:bg-blue-600 transition-colors flex-shrink-0"
                    >
                    <Send size={18} />
                    </button>
                </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a conversation or search for someone to start messaging
          </div>
        )}
      </div>

    </div>
  );
}


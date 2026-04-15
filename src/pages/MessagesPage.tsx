import { useEffect, useState, memo, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  listenToConversations,
  listenToMessages,
  sendMessage,
  getUser,
  getOrCreateConversation,
  getCallsBetweenUsers,
  type Conversation,
  type Message,
  type CallLog,
} from '../services/chatService';
import { 
  Search, Send, Video, Phone, MoreHorizontal, ChevronLeft, 
  Paperclip, Smile, Image, Mic, FileText, CheckCheck 
} from 'lucide-react';

type TimelineItem = 
  | { type: 'message'; data: Message }
  | { type: 'call'; data: CallLog };

const SearchInput = memo(({ value, onChange }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search by name, email..."
        value={value}
        onChange={onChange}
        className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
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
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [contactNames, setContactNames] = useState<Record<string, string>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const formatDuration = (totalSec: number): string => {
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    if (minutes === 0) return `${seconds} sec`;
    if (seconds === 0) return `${minutes} min`;
    return `${minutes} min ${seconds} sec`;
  };

  const timeline = useMemo<TimelineItem[]>(() => {
    const messageItems: TimelineItem[] = messages.map(msg => ({ type: 'message', data: msg }));
    const callItems: TimelineItem[] = calls.map(call => ({ type: 'call', data: call }));
    const allItems = [...messageItems, ...callItems];
    allItems.sort((a, b) => {
      const timeA = a.type === 'message' ? a.data.timestamp : a.data.createdAt;
      const timeB = b.type === 'message' ? b.data.timestamp : b.data.createdAt;
      return timeA.getTime() - timeB.getTime();
    });
    return allItems;
  }, [messages, calls]);

  // Load conversations
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = listenToConversations(async (convs) => {
      setConversations(convs);
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

  // Fetch all users
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

  // Sync selected conversation from URL
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) setSelectedConv(conv);
    } else if (!conversationId) {
      setSelectedConv(null);
    }
  }, [conversationId, conversations]);

  // Listen to messages of selected conversation
  useEffect(() => {
    if (!selectedConv) return;
    const unsubscribe = listenToMessages(selectedConv.id, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [selectedConv]);

  // Fetch calls between the two users when conversation changes
  useEffect(() => {
    if (!selectedConv || !currentUser) return;
    const otherId = selectedConv.participants.find(id => id !== currentUser.uid);
    if (!otherId) return;

    const fetchCalls = async () => {
      const callsData = await getCallsBetweenUsers(currentUser.uid, otherId);
      setCalls(callsData);
    };
    fetchCalls();
  }, [selectedConv, currentUser]);

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
    setSearchTerm('');
  };

  const getConversationDisplayName = (conv: Conversation) => {
    const otherId = conv.participants.find(id => id !== currentUser?.uid);
    return contactNames[otherId!] || otherId?.slice(0, 6) || 'Unknown';
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm.trim()) return true;
    const name = getConversationDisplayName(conv);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const existingContactIds = new Set(conversations.flatMap(c => c.participants));
  const filteredAllUsers = allUsers.filter(user => {
    if (!searchTerm.trim()) return !existingContactIds.has(user.id);
    const nameMatch = (user.name || user.email).toLowerCase().includes(searchTerm.toLowerCase());
    return !existingContactIds.has(user.id) && nameMatch;
  });

  const handleVideoCall = (conv: Conversation) => {
    const otherId = conv.participants.find(id => id !== currentUser?.uid);
    if (otherId) {
      window.open(
        `/call?receiverId=${otherId}&isVideo=true`,
        '_blank',
        `width=800,height=600,left=${(window.screen.width - 800) / 2},top=${(window.screen.height - 600) / 2},popup=1`
      );
    }
  };

  const handleAudioCall = (conv: Conversation) => {
    const otherId = conv.participants.find(id => id !== currentUser?.uid);
    if (otherId) {
      window.open(
        `/call?receiverId=${otherId}&isVideo=false`,
        '_blank',
        `width=800,height=600,left=${(window.screen.width - 800) / 2},top=${(window.screen.height - 600) / 2},popup=1`
      );
    }
  };

  // Placeholder for future features
  const handleAttachFile = () => {
    console.log('Attach file (coming soon)');
  };

  const handleEmoji = () => {
    console.log('Emoji picker (coming soon)');
  };

  const handleVoiceMessage = () => {
    console.log('Voice message (coming soon)');
  };

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-50 to-white">
      {/* Left sidebar */}
      <div className={`
        ${selectedConv ? 'hidden md:block' : 'block'} 
        w-full md:w-80 bg-white/80 backdrop-blur-sm border-r border-gray-200/50 flex flex-col shadow-sm
      `}>
        <div className="p-4 md:p-5 border-b border-gray-200/50">
          <h2 className="text-xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent mb-3 hidden md:block">
            Chats
          </h2>
          <SearchInput value={searchTerm} onChange={handleSearchChange} />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredConversations.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Recent
              </div>
              {filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 cursor-pointer ${
                    selectedConv?.id === conv.id
                      ? 'bg-blue-50/80 border-r-2 border-blue-500'
                      : 'hover:bg-gray-50 border-r-2 border-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-base font-medium shadow-sm">
                      {getConversationDisplayName(conv)[0].toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {getConversationDisplayName(conv)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {conv.lastMessage || 'Start a conversation'}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {conv.lastMessageTime
                      ? new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </div>
                </button>
              ))}
            </>
          )}

          {filteredAllUsers.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-200/50">
                All users
              </div>
              {filteredAllUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-base font-medium shadow-sm">
                      {(user.name?.[0] || user.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{user.name || user.email}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartNewChat(user)}
                    className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                  >
                    Message
                  </button>
                </div>
              ))}
            </>
          )}

          {loadingUsers && <div className="text-center text-gray-400 text-sm py-8">Loading users...</div>}
          {!loadingUsers && searchTerm && filteredConversations.length === 0 && filteredAllUsers.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12">No users or conversations found</div>
          )}
          {!loadingUsers && !searchTerm && conversations.length === 0 && allUsers.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12">No other users found</div>
          )}
        </div>
      </div>

      {/* Right chat area */}
      <div className={`
        ${!selectedConv ? 'hidden md:flex' : 'flex'} 
        flex-1 flex-col bg-gray-50
      `}>
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate('/messages')} className="md:hidden p-1 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <ChevronLeft size={24} />
                </button>
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                    {getConversationDisplayName(selectedConv)[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-800">{getConversationDisplayName(selectedConv)}</p>
                  <p className="text-xs text-green-600">Online</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleAudioCall(selectedConv)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <Phone size={20} />
                </button>
                <button onClick={() => handleVideoCall(selectedConv)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <Video size={20} />
                </button>
                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {timeline.map((item, idx) => {
                if (item.type === 'message') {
                  const msg = item.data;
                  const isOwn = msg.senderId === currentUser?.uid;
                  return (
                    <div key={msg.id || idx} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                      <div className={`max-w-[80%] md:max-w-[70%] px-4 py-2.5 text-sm shadow-sm transition-all ${
                        isOwn
                          ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
                          : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200/80'
                      }`}>
                        {msg.text}
                        <div className={`text-[10px] mt-1 flex items-center gap-1 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isOwn && <CheckCheck size={12} className="text-blue-200" />}
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  const call = item.data;
                  const callType = call.isVideo ? 'Video call' : 'Voice call';
                  let durationText = '';
                  if (call.endedAt && call.createdAt) {
                    const durationSec = Math.floor((call.endedAt.getTime() - call.createdAt.getTime()) / 1000);
                    if (durationSec > 0) {
                      durationText = ` ended ${formatDuration(durationSec)}`;
                    }
                  }
                  return (
                    <div key={call.id} className="flex justify-center animate-fade-in">
                      <div className="bg-gray-100/80 text-gray-600 text-xs px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
                        {callType}{durationText} • {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                }
              })}
              {timeline.length === 0 && (
                <div className="flex justify-center text-gray-400 text-sm py-12">
                  No messages or calls yet. Say hello!
                </div>
              )}
            </div>

            {/* Input area with action buttons */}
            <div className="p-3 bg-white/80 backdrop-blur-sm border-t border-gray-200/50">
              <div className="flex items-end gap-2">
                {/* Attachment button */}
                <button 
                  onClick={handleAttachFile}
                  className="p-2.5 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                  title="Attach file (coming soon)"
                >
                  <Paperclip size={20} />
                </button>
                
                {/* Image button */}
                <button 
                  onClick={handleAttachFile}
                  className="p-2.5 text-gray-500 hover:text-green-500 hover:bg-green-50 rounded-full transition-colors"
                  title="Send image (coming soon)"
                >
                  <Image size={20} />
                </button>

                {/* Text input */}
                <textarea
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
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
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none overflow-y-auto transition-all"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />
                
                {/* Emoji button */}
                <button 
                  onClick={handleEmoji}
                  className="p-2.5 text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 rounded-full transition-colors"
                  title="Add emoji (coming soon)"
                >
                  <Smile size={20} />
                </button>

                {/* Voice message button */}
                <button 
                  onClick={handleVoiceMessage}
                  className="p-2.5 text-gray-500 hover:text-purple-500 hover:bg-purple-50 rounded-full transition-colors"
                  title="Voice message (coming soon)"
                >
                  <Mic size={20} />
                </button>
                
                {/* Send button */}
                <button 
                  onClick={handleSend} 
                  disabled={!messageInput.trim()}
                  className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
                    messageInput.trim() 
                      ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-center p-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText size={40} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600">Your messages</h3>
            <p className="text-sm mt-1">Select a conversation or search for someone to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
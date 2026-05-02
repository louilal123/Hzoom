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
import { useUserPresence } from '../hooks/useUserPresence';
import { setTypingStatus, clearTypingStatus } from '../services/typingService';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import { getInitials } from '../utils/getInitials';

// UI components
import PresenceDot from '../components/ui/PresenceDot';
import TypingDots from '../components/ui/TypingDots';
import ConversationList from '../components/ConversationList';

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
      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search by name, email..."
        value={value}
        onChange={onChange}
        className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:bg-white transition-all"
      />
    </div>
  );
});

// Still defined outside for stability
const PresenceText = ({ uid }: { uid: string }) => {
  const { lastSeenText } = useUserPresence(uid);
  return <span className="text-xs text-gray-500">{lastSeenText}</span>;
};

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
const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [timeline, selectedConv]);

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

  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) setSelectedConv(conv);
    } else if (!conversationId) {
      setSelectedConv(null);
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    if (!selectedConv) return;
    const unsubscribe = listenToMessages(selectedConv.id, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [selectedConv]);

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

  const otherId = selectedConv?.participants.find(id => id !== currentUser?.uid);
  const isOtherTyping = useTypingIndicator(selectedConv?.id ?? '', otherId ?? '');

  // Stop typing when leaving conversation or unmounting
  useEffect(() => {
    return () => {
      if (selectedConv?.id && currentUser?.uid) {
        clearTypingStatus(selectedConv.id, currentUser.uid);
      }
    };
  }, [selectedConv?.id, currentUser?.uid]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedConv) return;
    try {
      await sendMessage(selectedConv.id, messageInput);
      setMessageInput('');
      
      // Reset textarea height when input is cleared
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      clearTypingStatus(selectedConv.id, currentUser!.uid);
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

  const handleAttachFile = () => console.log('Attach file (coming soon)');
  const handleEmoji = () => console.log('Emoji picker (coming soon)');
  const handleVoiceMessage = () => console.log('Voice message (coming soon)');

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessageInput(val);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

    if (selectedConv?.id && currentUser?.uid) {
      if (val.trim()) {
        setTypingStatus(selectedConv.id, currentUser.uid);
      } else {
        clearTypingStatus(selectedConv.id, currentUser.uid);
      }
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-white overflow-hidden">
      {/* Left sidebar – conversation list */}
      <div className={`
        ${selectedConv ? 'hidden md:block' : 'block'}
        w-full md:w-80 bg-white/80 backdrop-blur-sm border-r border-gray-200 flex flex-col shadow-sm overflow-hidden
      `}>
        <div className="p-4 md:p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent mb-3 hidden md:block">
            Chats
          </h2>
          <SearchInput value={searchTerm} onChange={handleSearchChange} />
        </div>

        {/* New ConversationList component */}
        <ConversationList
          filteredConversations={filteredConversations}
          selectedConvId={selectedConv?.id}
          contactNames={contactNames}
          currentUserId={currentUser?.uid}
          filteredAllUsers={filteredAllUsers}
          loadingUsers={loadingUsers}
          searchTerm={searchTerm}
          conversationsExist={conversations.length > 0}
          allUsersExist={allUsers.length > 0}
          onSelectConversation={handleSelectConversation}
          onStartNewChat={handleStartNewChat}
        />
      </div>

      {/* Right chat area */}
      <div className={`
        ${!selectedConv ? 'hidden md:flex' : 'flex'}
        flex-1 flex-col bg-gray-50 overflow-hidden
      `}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => navigate('/messages')}
                  className="md:hidden p-1 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-800 text-sm font-medium shadow-sm">
                    {getInitials(getConversationDisplayName(selectedConv))}
                  </div>
                  {otherId && <PresenceDot uid={otherId} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm md:text-base font-semibold text-gray-800 truncate">
                    {getConversationDisplayName(selectedConv)}
                  </p>
                  {otherId && <PresenceText uid={otherId} />}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleAudioCall(selectedConv)} className="p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <Phone size={18} />
                </button>
                <button onClick={() => handleVideoCall(selectedConv)} className="p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <Video size={18} />
                </button>
                <button className="hidden sm:block p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div ref={timelineRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 custom-scrollbar">
              {timeline.map((item, idx) => {
                if (item.type === 'message') {
                  const msg = item.data;
                  const isOwn = msg.senderId === currentUser?.uid;
                  return (
                    <div key={msg.id || idx} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      {!isOwn && (
                        <div className="flex-shrink-0 mr-2">
                          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-800 text-xs font-medium shadow-sm">
                            {getInitials(getConversationDisplayName(selectedConv!))}
                          </div>
                        </div>
                      )}
                      <div className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 text-sm shadow-sm ${
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
                    <div key={call.id} className="flex justify-center">
                      <div className="bg-gray-100/80 text-gray-600 text-xs px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
                        {callType}{durationText} • {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                }
              })}

              {/* Typing indicator (inside timeline) */}
              {otherId && isOtherTyping && (
                <div className="flex justify-start">
                  <div className="flex-shrink-0 mr-2">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-800 text-xs font-medium shadow-sm">
                      {getInitials(getConversationDisplayName(selectedConv!))}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200/80 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                    <TypingDots />
                  </div>
                </div>
              )}

              {timeline.length === 0 && (
                <div className="flex justify-center text-gray-400 text-sm py-12">
                  No messages or calls yet. Say hello!
                </div>
              )}
            </div>

            {/* Input area – responsive */}
            <div className="p-2 bg-white/80 backdrop-blur-sm border-t border-gray-200">
              <div className="flex items-end gap-1 overflow-hidden">
                <div className="hidden min-[480px]:flex gap-0.5 sm:gap-1">
                  <button
                    onClick={handleAttachFile}
                    className="p-1.5 sm:p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                    title="Attach file"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    onClick={handleAttachFile}
                    className="p-1.5 sm:p-2 text-gray-500 hover:text-green-500 hover:bg-green-50 rounded-full transition-colors"
                    title="Send image"
                  >
                    <Image size={18} />
                  </button>
                </div>

                <textarea
                  value={messageInput}
                   ref={textareaRef}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 min-w-0 px-3 py-2 bg-gray-100 rounded-2xl text-sm border-2 border-transparent focus:outline-none focus:border-gray-400 resize-none overflow-y-auto transition-all"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />

                <div className="hidden min-[480px]:flex gap-0.5 sm:gap-1">
                  <button
                    onClick={handleEmoji}
                    className="p-1.5 sm:p-2 text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 rounded-full transition-colors"
                    title="Add emoji"
                  >
                    <Smile size={18} />
                  </button>
                  <button
                    onClick={handleVoiceMessage}
                    className="p-1.5 sm:p-2 text-gray-500 hover:text-purple-500 hover:bg-purple-50 rounded-full transition-colors"
                    title="Voice message"
                  >
                    <Mic size={18} />
                  </button>
                </div>

                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim()}
                  className={`p-1.5 sm:p-2 rounded-full transition-all flex-shrink-0 ${
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
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 border border-gray-200">
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
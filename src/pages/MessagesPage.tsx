// src/pages/MessagesPage.tsx
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
  Paperclip, Smile, Image, Mic, FileText, CheckCheck, Plus, X,
} from 'lucide-react';

type TimelineItem =
  | { type: 'message'; data: Message }
  | { type: 'call'; data: CallLog };

// ─── Search input (memoised to avoid losing focus on re-renders) ──────────────
const SearchInput = memo(({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search by name, email…"
        value={value}
        onChange={onChange}
        className="w-full pl-9 pr-8 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
});

// ─── New-chat modal / panel ───────────────────────────────────────────────────
const NewChatModal = memo(({
  allUsers,
  existingContactIds,
  onStart,
  onClose,
}: {
  allUsers: any[];
  existingContactIds: Set<string>;
  onStart: (user: any) => void;
  onClose: () => void;
}) => {
  const [q, setQ] = useState('');
  const filtered = allUsers.filter(u => {
    const name = (u.name || u.email).toLowerCase();
    return !q || name.includes(q.toLowerCase());
  });

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
        style={{ maxHeight: '70vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">New conversation</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
            <input
              autoFocus
              type="text"
              placeholder="Search users…"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-10">No users found</p>
          )}
          {filtered.map(user => (
            <button
              key={user.id}
              onClick={() => onStart(user)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/60 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {(user.name?.[0] || user.email[0]).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{user.name || user.email}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── Main page ────────────────────────────────────────────────────────────────
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
  const [showNewChat, setShowNewChat] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const formatDuration = (totalSec: number): string => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m === 0) return `${s} sec`;
    if (s === 0) return `${m} min`;
    return `${m} min ${s} sec`;
  };

  const getConversationDisplayName = useCallback(
    (conv: Conversation) => {
      const otherId = conv.participants.find(id => id !== currentUser?.uid);
      return contactNames[otherId!] || otherId?.slice(0, 6) || 'Unknown';
    },
    [contactNames, currentUser],
  );

  // ── Timeline ─────────────────────────────────────────────────────────────────

  const timeline = useMemo<TimelineItem[]>(() => {
    const all: TimelineItem[] = [
      ...messages.map(d => ({ type: 'message' as const, data: d })),
      ...calls.map(d => ({ type: 'call' as const, data: d })),
    ];
    all.sort((a, b) => {
      const tA = a.type === 'message' ? a.data.timestamp : a.data.createdAt;
      const tB = b.type === 'message' ? b.data.timestamp : b.data.createdAt;
      return tA.getTime() - tB.getTime();
    });
    return all;
  }, [messages, calls]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [timeline, selectedConv]);

  // ── Data loading ─────────────────────────────────────────────────────────────

  // Conversations + contact names
  useEffect(() => {
    if (!currentUser) return;
    const unsub = listenToConversations(async (convs) => {
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
    return () => unsub();
  }, [currentUser]);

  // All users (for new chat)
  useEffect(() => {
    if (!currentUser) return;
    setLoadingUsers(true);
    getDocs(collection(db, 'users'))
      .then(snap => {
        setAllUsers(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((u: any) => u.id !== currentUser.uid),
        );
      })
      .catch(console.error)
      .finally(() => setLoadingUsers(false));
  }, [currentUser]);

  // Sync URL → selected conversation
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) setSelectedConv(conv);
    } else if (!conversationId) {
      setSelectedConv(null);
    }
  }, [conversationId, conversations]);

  // Messages listener
  useEffect(() => {
    if (!selectedConv) return;
    const unsub = listenToMessages(selectedConv.id, setMessages);
    return () => unsub();
  }, [selectedConv]);

  // Calls
  useEffect(() => {
    if (!selectedConv || !currentUser) return;
    const otherId = selectedConv.participants.find(id => id !== currentUser.uid);
    if (!otherId) return;
    getCallsBetweenUsers(currentUser.uid, otherId).then(setCalls).catch(console.error);
  }, [selectedConv, currentUser]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedConv) return;
    try {
      await sendMessage(selectedConv.id, messageInput);
      setMessageInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    navigate(`/messages/${conv.id}`);
  };

  const handleStartNewChat = async (otherUser: any) => {
    setShowNewChat(false);
    const convId = await getOrCreateConversation(otherUser.id);
    setContactNames(prev => ({ ...prev, [otherUser.id]: otherUser.name || otherUser.email }));
    navigate(`/messages/${convId}`);
    setSearchTerm('');
  };

  const handleVideoCall = (conv: Conversation) => {
    const otherId = conv.participants.find(id => id !== currentUser?.uid);
    if (otherId) {
      window.open(
        `/call?receiverId=${otherId}&isVideo=true`,
        '_blank',
        `width=800,height=600,left=${(window.screen.width - 800) / 2},top=${(window.screen.height - 600) / 2},popup=1`,
      );
    }
  };

  const handleAudioCall = (conv: Conversation) => {
    const otherId = conv.participants.find(id => id !== currentUser?.uid);
    if (otherId) {
      window.open(
        `/call?receiverId=${otherId}&isVideo=false`,
        '_blank',
        `width=800,height=600,left=${(window.screen.width - 800) / 2},top=${(window.screen.height - 600) / 2},popup=1`,
      );
    }
  };

  // ── Filtered lists ───────────────────────────────────────────────────────────

  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm.trim()) return true;
    return getConversationDisplayName(conv).toLowerCase().includes(searchTerm.toLowerCase());
  });

  const existingContactIds = useMemo(
    () => new Set(conversations.flatMap(c => c.participants)),
    [conversations],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-50 to-white overflow-hidden">

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <div className={`
        ${selectedConv ? 'hidden md:flex' : 'flex'}
        w-full md:w-80 lg:w-96
        flex-col bg-white/80 backdrop-blur-sm border-r border-gray-200/50 shadow-sm flex-shrink-0
      `}>

        {/* Sidebar header */}
        <div className="px-4 py-3 pt-14 md:pt-4 border-b border-gray-200/50">
          {/* Title row with + button */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
              Chats
            </h2>
            <button
              onClick={() => setShowNewChat(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow transition-colors"
              title="New conversation"
              aria-label="Start new conversation"
            >
              <Plus size={16} />
            </button>
          </div>

          <SearchInput
            value={searchTerm}
            onChange={handleSearchChange}
            onClear={() => setSearchTerm('')}
          />
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Recent
              </div>
              {filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-150 ${
                    selectedConv?.id === conv.id
                      ? 'bg-blue-50/80 border-r-2 border-blue-500'
                      : 'hover:bg-gray-50 border-r-2 border-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-base font-medium shadow-sm">
                      {getConversationDisplayName(conv)[0].toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
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

          {/* Empty / no results states */}
          {!loadingUsers && searchTerm && filteredConversations.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12 px-4">
              No conversations match your search.
              <br />
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-3 text-blue-500 hover:underline text-sm"
              >
                Start a new chat
              </button>
            </div>
          )}
          {!loadingUsers && !searchTerm && conversations.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12 px-4">
              No conversations yet.
              <br />
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-3 inline-flex items-center gap-1 text-blue-500 hover:underline text-sm"
              >
                <Plus size={14} /> Start your first chat
              </button>
            </div>
          )}
          {loadingUsers && (
            <div className="text-center text-gray-400 text-sm py-8">Loading…</div>
          )}
        </div>
      </div>

      {/* ── Right chat area ───────────────────────────────────────────────── */}
      <div className={`
        ${!selectedConv ? 'hidden md:flex' : 'flex'}
        flex-1 flex-col bg-gray-50 min-w-0
      `}>
        {selectedConv ? (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between px-3 md:px-5 py-3 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => navigate('/messages')}
                  className="md:hidden p-1.5 -ml-1 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronLeft size={22} />
                </button>
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                    {getConversationDisplayName(selectedConv)[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {getConversationDisplayName(selectedConv)}
                  </p>
                  <p className="text-xs text-green-600">Online</p>
                </div>
              </div>

              <div className="flex gap-0.5 flex-shrink-0">
                <button
                  onClick={() => handleAudioCall(selectedConv)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Phone size={19} />
                </button>
                <button
                  onClick={() => handleVideoCall(selectedConv)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Video size={19} />
                </button>
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                  <MoreHorizontal size={19} />
                </button>
              </div>
            </div>

            {/* Message timeline */}
            <div
              ref={timelineRef}
              className="flex-1 overflow-y-auto p-3 md:p-5 space-y-3"
            >
              {timeline.map((item, idx) => {
                if (item.type === 'message') {
                  const msg = item.data;
                  const isOwn = msg.senderId === currentUser?.uid;
                  return (
                    <div key={msg.id || idx} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] px-4 py-2.5 text-sm shadow-sm ${
                        isOwn
                          ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
                          : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200/80'
                      }`}>
                        {msg.text}
                        <div className={`text-[10px] mt-1 flex items-center gap-1 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
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
                    const sec = Math.floor((call.endedAt.getTime() - call.createdAt.getTime()) / 1000);
                    if (sec > 0) durationText = ` · ${formatDuration(sec)}`;
                  }
                  return (
                    <div key={call.id} className="flex justify-center">
                      <div className="bg-gray-100/80 text-gray-500 text-xs px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
                        {callType}{durationText} ·{' '}
                        {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                }
              })}

              {timeline.length === 0 && (
                <div className="flex justify-center text-gray-400 text-sm py-16">
                  No messages yet. Say hello! 👋
                </div>
              )}
            </div>

            {/* Message input */}
            <div className="px-3 py-2 md:px-4 md:py-3 bg-white/80 backdrop-blur-sm border-t border-gray-200/50">
              <div className="flex items-end gap-1.5">
                {/* Attach / image buttons — hidden on very small screens to save space */}
                <button
                  onClick={() => console.log('Attach (coming soon)')}
                  className="hidden sm:flex p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors flex-shrink-0"
                  title="Attach file"
                >
                  <Paperclip size={19} />
                </button>
                <button
                  onClick={() => console.log('Image (coming soon)')}
                  className="hidden sm:flex p-2 text-gray-500 hover:text-green-500 hover:bg-green-50 rounded-full transition-colors flex-shrink-0"
                  title="Send image"
                >
                  <Image size={19} />
                </button>

                {/* Text area */}
                <textarea
                  ref={textareaRef}
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
                  placeholder="Type a message…"
                  rows={1}
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none overflow-y-auto transition-all"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />

                <button
                  onClick={() => console.log('Emoji (coming soon)')}
                  className="p-2 text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 rounded-full transition-colors flex-shrink-0"
                  title="Emoji"
                >
                  <Smile size={19} />
                </button>
                <button
                  onClick={() => console.log('Voice (coming soon)')}
                  className="hidden sm:flex p-2 text-gray-500 hover:text-purple-500 hover:bg-purple-50 rounded-full transition-colors flex-shrink-0"
                  title="Voice message"
                >
                  <Mic size={19} />
                </button>

                {/* Send */}
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim()}
                  className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
                    messageInput.trim()
                      ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send size={17} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state (desktop only — sidebar covers mobile) */
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-center p-8 select-none">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText size={36} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600">Your messages</h3>
            <p className="text-sm mt-1 max-w-xs">
              Select a conversation from the left, or press&nbsp;
              <button
                onClick={() => setShowNewChat(true)}
                className="text-blue-500 hover:underline font-medium"
              >
                + New Chat
              </button>
              &nbsp;to start one.
            </p>
          </div>
        )}
      </div>

      {/* ── New chat modal ────────────────────────────────────────────────── */}
      {showNewChat && (
        <NewChatModal
          allUsers={allUsers}
          existingContactIds={existingContactIds}
          onStart={handleStartNewChat}
          onClose={() => setShowNewChat(false)}
        />
      )}
    </div>
  );
}
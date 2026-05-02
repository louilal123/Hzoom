import { useTypingIndicator } from '../hooks/useTypingIndicator';
import PresenceDot from './ui/PresenceDot';
import { getInitials } from '../utils/getInitials';
import type { Conversation } from '../services/chatService';

// ----------------------------------------------------------------
//  Individual conversation row – hooks live here, not in the loop
// ----------------------------------------------------------------
function ConversationItem({
  conv,
  isSelected,
  contactNames,
  currentUserId,
  onSelect,
}: {
  conv: Conversation;
  isSelected: boolean;
  contactNames: Record<string, string>;
  currentUserId: string | undefined;
  onSelect: (conv: Conversation) => void;
}) {
  const otherId = conv.participants.find(id => id !== currentUserId);
  const displayName =
    contactNames[otherId!] || otherId?.slice(0, 6) || 'Unknown';

  const isTyping = useTypingIndicator(conv.id, otherId ?? '');

  return (
    <button
      onClick={() => onSelect(conv)}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 cursor-pointer border-b border-gray-100 ${
        isSelected
          ? 'bg-gray-200 border-r-2 border-blue-500'
          : 'hover:bg-gray-50 border-r-2 border-transparent'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-800 text-base font-medium shadow-sm">
          {getInitials(displayName)}
        </div>
        {otherId && <PresenceDot uid={otherId} />}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {displayName}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {isTyping
            ? `${displayName} is typing...`
            : conv.lastMessage || 'Start a conversation'}
        </p>
      </div>
      <div className="text-xs text-gray-400 flex-shrink-0 ml-2">
        {conv.lastMessageTime
          ? new Date(conv.lastMessageTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : ''}
      </div>
    </button>
  );
}

// ----------------------------------------------------------------
//  Main list
// ----------------------------------------------------------------
interface ConversationListProps {
  filteredConversations: Conversation[];
  selectedConvId: string | undefined;
  contactNames: Record<string, string>;
  currentUserId: string | undefined;
  filteredAllUsers: any[];
  loadingUsers: boolean;
  searchTerm: string;
  conversationsExist: boolean;
  allUsersExist: boolean;
  onSelectConversation: (conv: Conversation) => void;
  onStartNewChat: (user: any) => void;
}

export default function ConversationList({
  filteredConversations,
  selectedConvId,
  contactNames,
  currentUserId,
  filteredAllUsers,
  loadingUsers,
  searchTerm,
  conversationsExist,
  allUsersExist,
  onSelectConversation,
  onStartNewChat,
}: ConversationListProps) {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* Conversations Section */}
      {filteredConversations.length > 0 && (
        <>
          <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Recent
          </div>
          {filteredConversations.map(conv => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              isSelected={selectedConvId === conv.id}
              contactNames={contactNames}
              currentUserId={currentUserId}
              onSelect={onSelectConversation}
            />
          ))}
        </>
      )}

      {/* All Users Section */}
      {filteredAllUsers.length > 0 && (
        <>
          <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-200">
            All users
          </div>
          {filteredAllUsers.map(user => (
            <div
              key={user.id}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-800 text-base font-medium shadow-sm flex-shrink-0">
                  {getInitials(user.name || user.email)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {user.name || user.email}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => onStartNewChat(user)}
                className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors shadow-sm flex-shrink-0 ml-2"
              >
                Message
              </button>
            </div>
          ))}
        </>
      )}

      {/* Loading / Empty states */}
      {loadingUsers && (
        <div className="text-center text-gray-400 text-sm py-8">Loading users...</div>
      )}
      {!loadingUsers && searchTerm && filteredConversations.length === 0 && filteredAllUsers.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-12">
          No users or conversations found
        </div>
      )}
      {!loadingUsers && !searchTerm && !conversationsExist && !allUsersExist && (
        <div className="text-center text-gray-400 text-sm py-12">
          No other users found
        </div>
      )}
    </div>
  );
}
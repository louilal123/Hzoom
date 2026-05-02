import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import TypingDots from './TypingDots';

interface TypingPreviewProps {
  convId: string;
  otherUserId: string | undefined;
  lastMessage: string | undefined;
  displayName?: string;  // <-- new
}

export default function TypingPreview({
  convId,
  otherUserId,
  lastMessage,
  displayName,
}: TypingPreviewProps) {
  const isTyping = useTypingIndicator(convId, otherUserId ?? '');

  if (isTyping) {
    return (
      <span className="text-xs text-blue-500 flex items-center gap-1 min-w-0">
        <span className="truncate">
          {displayName || 'Someone'} is typing
        </span>
        <TypingDots />
      </span>
    );
  }

  return (
    <span className="text-xs text-gray-500 truncate">
      {lastMessage || 'Start a conversation'}
    </span>
  );
}
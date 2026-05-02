import { useUserPresence } from '../../hooks/useUserPresence';

export default function PresenceDot({ uid }: { uid: string }) {
  const { online } = useUserPresence(uid);
  return (
    <span
      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
        online ? 'bg-green-500' : 'bg-gray-300'
      }`}
      title={online ? 'Online now' : 'Offline'}
    />
  );
}
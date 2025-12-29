import { useEffect, useRef, useState } from 'react';
import { PaperPlaneRightIcon, SpinnerIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/livekit/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  chatOpen: boolean;
  isAgentAvailable?: boolean;
  onSend?: (message: string) => void;
}

export function ChatInput({
  chatOpen,
  isAgentAvailable = false,
  onSend = async () => {},
}: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setIsSending(true);
      await onSend(message);
      setMessage('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const isDisabled = isSending || !isAgentAvailable || message.trim().length === 0;

  useEffect(() => {
    if (chatOpen && isAgentAvailable) return;
    // when not disabled refocus on input
    inputRef.current?.focus();
  }, [chatOpen, isAgentAvailable]);

  return (
    <div
      className={cn(
        'border-input/50 flex w-full items-start overflow-hidden border-b transition-all duration-300',
        chatOpen ? 'mb-2 h-auto opacity-100 sm:mb-3' : 'mb-0 h-0 opacity-0'
      )}
    >
      <form
        onSubmit={handleSubmit}
        className="mb-2 flex grow items-end gap-1.5 rounded-md pl-0.5 text-xs sm:mb-3 sm:gap-2 sm:pl-1 sm:text-sm"
      >
        <input
          autoFocus
          ref={inputRef}
          type="text"
          value={message}
          disabled={!chatOpen}
          placeholder="Écrivez quelque chose..."
          onChange={(e) => setMessage(e.target.value)}
          className="h-7 flex-1 text-xs focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:text-sm"
        />
        <Button
          size="icon"
          type="submit"
          disabled={isDisabled}
          variant={isDisabled ? 'secondary' : 'primary'}
          title={isSending ? 'Envoi...' : 'Envoyer'}
          className="h-7 w-7 self-start sm:h-9 sm:w-9"
        >
          {isSending ? (
            <SpinnerIcon className="h-3 w-3 animate-spin sm:h-4 sm:w-4" weight="bold" />
          ) : (
            <PaperPlaneRightIcon className="h-3 w-3 sm:h-4 sm:w-4" weight="bold" />
          )}
        </Button>
      </form>
    </div>
  );
}

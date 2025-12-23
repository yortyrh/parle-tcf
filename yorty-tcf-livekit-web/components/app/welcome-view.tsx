import Image from 'next/image';
import { Button } from '@/components/livekit/button';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export function WelcomeView({ startButtonText, onStartCall }: WelcomeViewProps) {
  return (
    <section className="flex h-full w-full flex-col items-center justify-center text-center">
      <Image
        src="/logo.png"
        alt="TCF AI Logo"
        width={128}
        height={128}
        className="mb-6 h-32 w-32 object-contain"
      />
      <h1 className="max-w-prose pt-1 text-lg leading-6 font-medium">
        Discutez en direct avec votre agent vocal TCF
      </h1>
      <Button variant="primary" size="lg" onClick={onStartCall} className="mt-6 w-64 font-mono">
        {startButtonText}
      </Button>
    </section>
  );
}

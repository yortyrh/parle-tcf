import { AuthGate } from '@/components/app/auth-gate';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return <AuthGate>{children}</AuthGate>;
}

import type { Metadata, Viewport } from 'next';
import { Fraunces, Public_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { ThemeProvider } from '@/components/app/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn, getAppConfig, getSiteUrl } from '@/lib/utils';
import '@/styles/globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
});

const commitMono = localFont({
  display: 'swap',
  variable: '--font-commit-mono',
  src: [
    {
      path: '../fonts/CommitMono-400-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-400-Italic.otf',
      weight: '400',
      style: 'italic',
    },
  ],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export function generateMetadata(): Metadata {
  const appConfig = getAppConfig();
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: appConfig.pageTitle, template: `%s · ${appConfig.pageTitle}` },
    description: appConfig.pageDescription,
    applicationName: appConfig.pageTitle,
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      siteName: appConfig.pageTitle,
      title: appConfig.pageTitle,
      description: appConfig.pageDescription,
    },
    twitter: { card: 'summary_large_image' },
    icons: {
      icon: '/logo.png',
      shortcut: '/logo.png',
      apple: '/logo.png',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={cn(
        publicSans.variable,
        fraunces.variable,
        commitMono.variable,
        'scroll-smooth font-sans antialiased'
      )}
    >
      <head>
        <link rel="icon" type="image/png" href="/icon.png" />
      </head>
      <body className="touch-manipulation overflow-x-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

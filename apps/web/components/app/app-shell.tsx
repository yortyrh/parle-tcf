'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { GearSixIcon, ListIcon, ShieldCheckIcon, SignOutIcon } from '@phosphor-icons/react';
import { Brand } from '@/components/app/brand';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { authClient } from '@/lib/auth-client';
import { clearSessionToken } from '@/lib/session-token';
import { cn } from '@/lib/utils';

export const APP_NAV = [
  { href: '/tableau-de-bord', label: 'Tableau de bord' },
  { href: '/tcf', label: 'S’entraîner' },
  { href: '/examen', label: 'Examen complet' },
  { href: '/sujets', label: 'Sujets' },
  { href: '/historique', label: 'Historique' },
  { href: '/progression', label: 'Progression' },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {APP_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function initials(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function UserMenu() {
  const router = useRouter();
  const { data } = authClient.useSession();
  const user = data?.user;

  async function signOut() {
    await authClient.signOut().catch(() => null);
    clearSessionToken();
    router.replace('/connexion');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full"
          aria-label={user ? `Menu du compte (${user.email})` : 'Menu du compte'}
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {user ? initials(user.name, user.email) : '…'}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {user && (
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{user.name || 'Mon compte'}</span>
            <span className="text-muted-foreground truncate text-xs font-normal">{user.email}</span>
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/parametres">
            <GearSixIcon aria-hidden /> Paramètres
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/confidentialite">
            <ShieldCheckIcon aria-hidden /> Confidentialité
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <ThemeToggle className="w-fit" />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <SignOutIcon aria-hidden /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Ouvrir le menu">
          <ListIcon className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="font-display text-left text-lg">Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="Navigation principale" className="flex flex-col gap-1 px-4">
          <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/** Header of the signed-in area: brand, navigation (sheet on mobile) and account menu. */
export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
      <a
        href="#contenu"
        className="bg-primary text-primary-foreground sr-only rounded-full px-4 py-2 focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50"
      >
        Aller au contenu
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        <MobileNav pathname={pathname} />
        <Brand href="/tableau-de-bord" />
        <nav
          aria-label="Navigation principale"
          className="ml-4 hidden flex-1 items-center gap-1 md:flex"
        >
          <NavLinks pathname={pathname} />
        </nav>
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

'use client';

import { GithubLogoIcon, GoogleLogoIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { getApiBase } from '@/lib/api';
import { type OAuthProvider, enabledOAuthProviders, oauthStartUrl } from '@/lib/oauth';

// Literal references so Next.js inlines the public flags at build time.
const PROVIDERS = enabledOAuthProviders({
  NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED: process.env.NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED,
  NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED: process.env.NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED,
});

const LABELS: Record<OAuthProvider, { label: string; Icon: typeof GithubLogoIcon }> = {
  github: { label: 'Continuer avec GitHub', Icon: GithubLogoIcon },
  google: { label: 'Continuer avec Google', Icon: GoogleLogoIcon },
};

/** GitHub/Google buttons; rendered only for providers configured on the API (`pnpm setup:env`). */
export function OAuthButtons({ next }: { next: string }) {
  if (PROVIDERS.length === 0) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {PROVIDERS.map((provider) => {
        const { label, Icon } = LABELS[provider];
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.location.assign(oauthStartUrl(provider, next, getApiBase()))}
          >
            <Icon aria-hidden weight="bold" />
            {label}
          </Button>
        );
      })}
      <div className="text-muted-foreground my-2 flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />
        ou
        <span className="bg-border h-px flex-1" />
      </div>
    </div>
  );
}

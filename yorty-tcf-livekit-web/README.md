# TCF LiveKit Web Interface

Interface web pour l'agent vocal TCF (Test de Connaissance du Français).

## Description

Cette application Next.js fournit une interface utilisateur simplifiée pour interagir avec un agent vocal LiveKit dédié aux exercices TCF.

## Fonctionnalités

- Interface vocale en temps réel avec les agents LiveKit
- Transcription des conversations
- Support du chat textuel
- Thème clair/sombre avec détection des préférences système
- Interface moderne et épurée

## Structure du projet

```
yorty-tcf-livekit-web/
├── app/
│   ├── (app)/          # Pages de l'application
│   ├── api/            # Routes API (connexion LiveKit)
│   └── layout.tsx      # Layout racine
├── components/
│   ├── app/            # Composants de l'application
│   └── livekit/        # Composants LiveKit réutilisables
├── hooks/              # Hooks React personnalisés
├── lib/                # Utilitaires
├── styles/             # Styles globaux
└── app-config.ts       # Configuration de l'application
```

## Installation

```bash
pnpm install
```

## Configuration

Créez un fichier `.env.local` avec vos identifiants LiveKit :

```env
LIVEKIT_API_KEY=votre_cle_api_livekit
LIVEKIT_API_SECRET=votre_secret_api_livekit
LIVEKIT_URL=https://votre-serveur-livekit
```

## Développement

```bash
pnpm dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## Production

```bash
pnpm build
pnpm start
```

## Configuration de l'application

Modifiez `app-config.ts` pour personnaliser :

- Titre et description de la page
- Texte du bouton de démarrage
- Fonctionnalités activées (chat, vidéo, partage d'écran)
- Couleurs du thème
- Logo

## Technologies

- **Next.js 15** - Framework React
- **LiveKit** - Infrastructure de communication en temps réel
- **Tailwind CSS** - Framework CSS utilitaire
- **TypeScript** - Typage statique
- **Sonner** - Notifications toast
- **next-themes** - Gestion des thèmes

## License

MIT

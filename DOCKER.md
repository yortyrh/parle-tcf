# Guide Docker pour TCF LiveKit

Ce guide explique comment démarrer le projet TCF LiveKit avec Docker Compose.

## Prérequis

- Docker (version 20.10 ou supérieure)
- Docker Compose (version 2.0 ou supérieure)
- Identifiants LiveKit Cloud
- Clé API OpenAI

## Configuration rapide

### 1. Créer le fichier d'environnement

Copiez le fichier d'exemple et remplissez vos identifiants :

```bash
cp .env.example .env
```

Éditez le fichier `.env` avec vos identifiants :

```env
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxx

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxx
```

### 2. Démarrer les services

```bash
docker-compose up -d
```

Cette commande va :
- Construire les images Docker pour l'agent et l'application web
- Démarrer les deux services en arrière-plan
- Créer un réseau Docker pour la communication entre services

### 3. Vérifier le statut

```bash
docker-compose ps
```

Vous devriez voir :
- `tcf-agent` - En cours d'exécution
- `tcf-web` - En cours d'exécution sur le port 3000

### 4. Accéder à l'application

Ouvrez votre navigateur et accédez à :
```
http://localhost:3000
```

## Commandes utiles

### Voir les logs

```bash
# Tous les services
docker-compose logs -f

# Agent seulement
docker-compose logs -f agent

# Web seulement
docker-compose logs -f web
```

### Arrêter les services

```bash
# Arrêter sans supprimer les conteneurs
docker-compose stop

# Arrêter et supprimer les conteneurs
docker-compose down
```

### Redémarrer les services

```bash
# Redémarrer tous les services
docker-compose restart

# Redémarrer un service spécifique
docker-compose restart agent
docker-compose restart web
```

### Reconstruire les images

Si vous modifiez le code, reconstruisez les images :

```bash
# Reconstruire et redémarrer
docker-compose up -d --build

# Reconstruire un service spécifique
docker-compose build agent
docker-compose build web
```

### Nettoyer complètement

```bash
# Arrêter et supprimer tout (conteneurs, réseaux, volumes)
docker-compose down -v

# Supprimer aussi les images
docker-compose down -v --rmi all
```

## Structure des services

### Agent (tcf-agent)

- **Port** : Aucun exposé (communication interne via LiveKit)
- **Dépendances** : LiveKit Cloud, OpenAI API
- **Configuration** : Fichiers YAML dans `tcf-tache-1/config/`

### Web (tcf-web)

- **Port** : 3000 (mappé vers l'hôte)
- **Dépendances** : Agent, LiveKit Cloud
- **Framework** : Next.js

## Volumes montés

Le fichier docker-compose monte les fichiers de configuration de l'agent en lecture seule :
- `./yorty-tcf-livekit-agent/config:/app/config:ro`

Cela permet de modifier les configurations YAML sans reconstruire l'image.

## Réseau

Les services communiquent via un réseau Docker bridge nommé `tcf-network`.

## Healthchecks

Les deux services incluent des healthchecks pour surveiller leur état :
- **Agent** : Vérifie que Node.js fonctionne
- **Web** : Vérifie que le serveur Next.js répond sur le port 3000

## Dépannage

### Le conteneur agent ne démarre pas

Vérifiez les logs :
```bash
docker-compose logs agent
```

Causes communes :
- Identifiants LiveKit incorrects
- Clé API OpenAI manquante ou invalide

### Le conteneur web ne démarre pas

Vérifiez les logs :
```bash
docker-compose logs web
```

Causes communes :
- Identifiants LiveKit incorrects
- Port 3000 déjà utilisé

### Changer le port de l'application web

Éditez `docker-compose.yml` et modifiez la ligne :
```yaml
ports:
  - "8080:3000"  # Utilise le port 8080 au lieu de 3000
```

### Variables d'environnement non chargées

Assurez-vous que le fichier `.env` est à la racine du projet (même répertoire que `docker-compose.yml`).

## Développement

Pour le développement, il est recommandé d'exécuter les services localement avec :

```bash
# Agent
cd yorty-tcf-livekit-agent
pnpm install
pnpm dev

# Web
cd yorty-tcf-livekit-web
pnpm install
pnpm dev
```

Docker Compose est principalement destiné au déploiement en production ou aux tests d'intégration.

## Production

Pour un déploiement en production, considérez :

1. **Variables d'environnement sécurisées** : Utilisez Docker secrets ou un gestionnaire de secrets
2. **Reverse proxy** : Ajoutez Nginx ou Traefik pour le SSL/TLS
3. **Monitoring** : Intégrez des outils de monitoring (Prometheus, Grafana)
4. **Logs** : Configurez un système de logging centralisé
5. **Scaling** : Utilisez Docker Swarm ou Kubernetes pour l'orchestration

## Support

Pour plus d'informations, consultez :
- [README.md](./README.md) - Documentation générale du projet
- [yorty-tcf-livekit-agent/README.md](./yorty-tcf-livekit-agent/README.md) - Documentation de l'agent
- [yorty-tcf-livekit-web/README.md](./yorty-tcf-livekit-web/README.md) - Documentation de l'application web


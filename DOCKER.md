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

### Déploiement sur EC2 (ou serveur distant)

Si votre serveur a une version ancienne de Docker/Buildx, utilisez cette méthode :

#### 1. Sur votre machine locale

```bash
# Définir votre nom d'utilisateur Docker Hub
export DOCKER_USERNAME=votre-username

# Exécuter le script de déploiement
./deploy.sh
```

Ou manuellement :

```bash
# Se connecter à Docker Hub
docker login

# Builder les images
docker compose build

# Tag et push
docker tag yorty-tcf-livekit-agent:latest votre-username/yorty-tcf-livekit-agent:latest
docker tag yorty-tcf-livekit-web:latest votre-username/yorty-tcf-livekit-web:latest

docker push votre-username/yorty-tcf-livekit-agent:latest
docker push votre-username/yorty-tcf-livekit-web:latest
```

#### 2. Sur votre serveur EC2

```bash
# Copier les fichiers nécessaires
scp docker-compose.prod.yml ec2-user@your-ec2-ip:~/
scp -r yorty-tcf-livekit-agent/config ec2-user@your-ec2-ip:~/yorty-tcf-livekit-agent/
scp .env ec2-user@your-ec2-ip:~/

# Se connecter au serveur
ssh ec2-user@your-ec2-ip

# Éditer docker-compose.prod.yml et remplacer <votre-username>
sed -i 's/<votre-username>/votre-username/g' docker-compose.prod.yml

# Pull les images
docker compose -f docker-compose.prod.yml pull

# Démarrer les services
docker compose -f docker-compose.prod.yml up -d

# Voir les logs
docker compose -f docker-compose.prod.yml logs -f
```

#### 3. Mettre à jour le déploiement

```bash
# Sur votre machine locale
./deploy.sh

# Sur EC2
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Mise à jour de Docker sur EC2

Si vous préférez mettre à jour Docker sur EC2 :

```bash
# Amazon Linux 2
sudo yum update -y docker
sudo systemctl restart docker

# Ou installer la dernière version
sudo yum remove docker docker-client docker-client-latest docker-common
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl start docker
sudo usermod -aG docker ec2-user
```

### Recommandations pour la production

1. **Variables d'environnement sécurisées** : Utilisez AWS Secrets Manager ou Docker secrets
2. **Reverse proxy** : Ajoutez Nginx ou Traefik pour le SSL/TLS avec Let's Encrypt
3. **Monitoring** : Intégrez CloudWatch, Prometheus, ou Grafana
4. **Logs** : Configurez CloudWatch Logs ou un système de logging centralisé
5. **Scaling** : Utilisez AWS ECS, Docker Swarm ou Kubernetes pour l'orchestration
6. **Backup** : Sauvegardez régulièrement les configurations et données
7. **Security Groups** : Configurez correctement les groupes de sécurité EC2
8. **SSL/TLS** : Utilisez un certificat SSL pour sécuriser les communications

## Support

Pour plus d'informations, consultez :
- [README.md](./README.md) - Documentation générale du projet
- [yorty-tcf-livekit-agent/README.md](./yorty-tcf-livekit-agent/README.md) - Documentation de l'agent
- [yorty-tcf-livekit-web/README.md](./yorty-tcf-livekit-web/README.md) - Documentation de l'application web


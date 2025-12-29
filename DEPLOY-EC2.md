# Déploiement sur AWS EC2

Guide pas à pas pour déployer yorty-tcf-livekit sur une instance AWS EC2.

## Prérequis

- Une instance EC2 (recommandé: t3.medium ou supérieur)
- Amazon Linux 2 ou Ubuntu
- Docker installé sur l'EC2
- Un compte Docker Hub
- Accès SSH à votre instance EC2

## Méthode 1 : Images pré-buildées (Recommandé)

Cette méthode évite les problèmes de version Docker/Buildx sur EC2.

### Étape 1 : Builder et pousser les images localement

Sur votre machine locale :

```bash
# Se placer dans le répertoire du projet
cd /Users/yorty/WebstormProjects/yorty-tcf-livekit

# Définir votre nom d'utilisateur Docker Hub
export DOCKER_USERNAME=votre-username-dockerhub

# Exécuter le script de déploiement
./deploy.sh
```

Le script va :
- Se connecter à Docker Hub
- Builder les deux images (agent et web)
- Les taguer avec votre username
- Les pousser vers Docker Hub

### Étape 2 : Préparer les fichiers pour EC2

```bash
# Éditer docker-compose.prod.yml et remplacer <votre-username>
sed -i '' "s/<votre-username>/${DOCKER_USERNAME}/g" docker-compose.prod.yml

# Ou éditez manuellement le fichier
```

### Étape 3 : Copier les fichiers sur EC2

```bash
# Remplacer par l'IP de votre EC2
EC2_IP="your-ec2-ip"
EC2_USER="ec2-user"  # ou "ubuntu" selon votre AMI

# Créer les répertoires sur EC2
ssh ${EC2_USER}@${EC2_IP} "mkdir -p yorty-tcf-livekit/yorty-tcf-livekit-agent"

# Copier les fichiers
scp docker-compose.prod.yml ${EC2_USER}@${EC2_IP}:~/yorty-tcf-livekit/
scp .env.example ${EC2_USER}@${EC2_IP}:~/yorty-tcf-livekit/.env
scp -r yorty-tcf-livekit-agent/config ${EC2_USER}@${EC2_IP}:~/yorty-tcf-livekit/yorty-tcf-livekit-agent/
```

### Étape 4 : Configurer sur EC2

```bash
# Se connecter à EC2
ssh ${EC2_USER}@${EC2_IP}

# Aller dans le répertoire
cd yorty-tcf-livekit

# Éditer le fichier .env avec vos identifiants
nano .env
```

Ajoutez vos variables :
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxx
```

### Étape 5 : Démarrer les services

```bash
# Pull les images depuis Docker Hub
docker compose -f docker-compose.prod.yml pull

# Démarrer les services
docker compose -f docker-compose.prod.yml up -d

# Vérifier les logs
docker compose -f docker-compose.prod.yml logs -f
```

### Étape 6 : Configurer le pare-feu

Dans la console AWS, ajoutez une règle au Security Group :
- Type: Custom TCP
- Port: 3000
- Source: 0.0.0.0/0 (ou votre IP spécifique)

### Étape 7 : Accéder à l'application

Ouvrez votre navigateur :
```
http://your-ec2-ip:3000
```

## Méthode 2 : Builder directement sur EC2

Si vous avez une version récente de Docker sur EC2 :

### 1. Installer/Mettre à jour Docker

```bash
# Amazon Linux 2
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Se déconnecter et se reconnecter pour appliquer les changements de groupe
exit
```

### 2. Cloner le projet

```bash
ssh ${EC2_USER}@${EC2_IP}

# Installer git si nécessaire
sudo yum install -y git

# Cloner le repository
git clone <votre-repo-url> yorty-tcf-livekit
cd yorty-tcf-livekit
```

### 3. Configurer et démarrer

```bash
# Créer le fichier .env
cp .env.example .env
nano .env

# Builder et démarrer
docker compose build
docker compose up -d
```

## Mise à jour du déploiement

### Avec les images pré-buildées

```bash
# Sur votre machine locale
./deploy.sh

# Sur EC2
ssh ${EC2_USER}@${EC2_IP}
cd yorty-tcf-livekit
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Avec le build direct

```bash
# Sur EC2
ssh ${EC2_USER}@${EC2_IP}
cd yorty-tcf-livekit
git pull
docker compose build
docker compose up -d
```

## Commandes utiles

```bash
# Voir les logs
docker compose -f docker-compose.prod.yml logs -f

# Voir les logs d'un service spécifique
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f agent

# Redémarrer les services
docker compose -f docker-compose.prod.yml restart

# Arrêter les services
docker compose -f docker-compose.prod.yml down

# Voir l'état des services
docker compose -f docker-compose.prod.yml ps

# Entrer dans un conteneur
docker compose -f docker-compose.prod.yml exec web sh
docker compose -f docker-compose.prod.yml exec agent sh
```

## Dépannage

### Les images ne se chargent pas

```bash
# Vérifier que vous êtes connecté à Docker Hub
docker login

# Vérifier que les images existent
docker search votre-username/yorty-tcf-livekit
```

### Erreur "port already in use"

```bash
# Vérifier les processus sur le port 3000
sudo lsof -i :3000

# Arrêter le processus si nécessaire
sudo kill <PID>
```

### Problèmes de permissions

```bash
# Vérifier que l'utilisateur est dans le groupe docker
groups

# Si docker n'apparaît pas, l'ajouter
sudo usermod -aG docker $USER

# Se déconnecter et se reconnecter
exit
```

### Les services ne démarrent pas

```bash
# Vérifier les logs détaillés
docker compose -f docker-compose.prod.yml logs

# Vérifier l'état de Docker
sudo systemctl status docker

# Redémarrer Docker
sudo systemctl restart docker
```

## Optimisations pour la production

### 1. Utiliser un reverse proxy avec SSL

Installez Nginx avec Let's Encrypt :

```bash
sudo yum install -y nginx certbot python3-certbot-nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Configurer Nginx
sudo nano /etc/nginx/conf.d/yorty-tcf-livekit.conf
```

Contenu de la configuration Nginx :
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Tester et recharger Nginx
sudo nginx -t
sudo systemctl reload nginx

# Obtenir un certificat SSL
sudo certbot --nginx -d your-domain.com
```

### 2. Monitoring avec CloudWatch

Configurez CloudWatch Logs pour Docker :

```bash
sudo yum install -y amazon-cloudwatch-agent

# Configurer l'agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

### 3. Sauvegardes automatiques

Créez un script de backup :

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/home/ec2-user/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup de la config
tar -czf $BACKUP_DIR/config-$DATE.tar.gz yorty-tcf-livekit-agent/config

# Backup du .env
cp .env $BACKUP_DIR/.env-$DATE

# Garder seulement les 7 derniers backups
find $BACKUP_DIR -type f -mtime +7 -delete
```

Ajoutez à crontab :
```bash
crontab -e
# Ajouter cette ligne pour un backup quotidien à 2h du matin
0 2 * * * /home/ec2-user/backup.sh
```

## Sécurité

1. **Utilisez des variables d'environnement sécurisées** - Ne committez jamais le fichier `.env`
2. **Mettez à jour régulièrement** - Gardez Docker et les dépendances à jour
3. **Configurez un pare-feu** - Limitez l'accès aux ports nécessaires uniquement
4. **Utilisez SSL/TLS** - Toujours en production avec un vrai domaine
5. **Surveillez les logs** - Activez CloudWatch ou un système de monitoring
6. **Sauvegardez régulièrement** - Automatisez les backups des configurations

## Support

Pour plus d'informations, consultez :
- [DOCKER.md](./DOCKER.md) - Documentation Docker complète
- [README.md](./README.md) - Documentation générale du projet


#!/bin/bash

# Script de déploiement pour yorty-tcf-livekit
# Ce script build les images localement et les pousse vers Docker Hub

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Déploiement yorty-tcf-livekit ===${NC}"
echo ""

# Vérifier si DOCKER_USERNAME est défini
if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${YELLOW}Variable DOCKER_USERNAME non définie.${NC}"
    read -p "Entrez votre nom d'utilisateur Docker Hub: " DOCKER_USERNAME
    export DOCKER_USERNAME
fi

echo -e "${GREEN}Nom d'utilisateur Docker Hub: ${DOCKER_USERNAME}${NC}"
echo ""

# Se connecter à Docker Hub si nécessaire
echo -e "${YELLOW}Connexion à Docker Hub...${NC}"
docker login || {
    echo -e "${RED}Échec de la connexion à Docker Hub${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}1. Building des images...${NC}"
docker compose build

echo ""
echo -e "${GREEN}2. Tagging des images...${NC}"
docker tag yorty-tcf-livekit-agent:latest ${DOCKER_USERNAME}/yorty-tcf-livekit-agent:latest
docker tag yorty-tcf-livekit-web:latest ${DOCKER_USERNAME}/yorty-tcf-livekit-web:latest

# Optionnel: créer aussi un tag avec la date pour le versioning
DATE_TAG=$(date +%Y%m%d-%H%M%S)
docker tag yorty-tcf-livekit-agent:latest ${DOCKER_USERNAME}/yorty-tcf-livekit-agent:${DATE_TAG}
docker tag yorty-tcf-livekit-web:latest ${DOCKER_USERNAME}/yorty-tcf-livekit-web:${DATE_TAG}

echo ""
echo -e "${GREEN}3. Pushing des images vers Docker Hub...${NC}"
docker push ${DOCKER_USERNAME}/yorty-tcf-livekit-agent:latest
docker push ${DOCKER_USERNAME}/yorty-tcf-livekit-web:latest
docker push ${DOCKER_USERNAME}/yorty-tcf-livekit-agent:${DATE_TAG}
docker push ${DOCKER_USERNAME}/yorty-tcf-livekit-web:${DATE_TAG}

echo ""
echo -e "${GREEN}=== Déploiement terminé avec succès! ===${NC}"
echo ""
echo -e "${YELLOW}Images disponibles:${NC}"
echo "  - ${DOCKER_USERNAME}/yorty-tcf-livekit-agent:latest"
echo "  - ${DOCKER_USERNAME}/yorty-tcf-livekit-agent:${DATE_TAG}"
echo "  - ${DOCKER_USERNAME}/yorty-tcf-livekit-web:latest"
echo "  - ${DOCKER_USERNAME}/yorty-tcf-livekit-web:${DATE_TAG}"
echo ""
echo -e "${YELLOW}Pour déployer sur EC2:${NC}"
echo "  1. Copiez docker-compose.prod.yml sur votre EC2"
echo "  2. Remplacez <votre-username> par ${DOCKER_USERNAME}"
echo "  3. Créez un fichier .env avec vos variables"
echo "  4. Exécutez: docker compose -f docker-compose.prod.yml pull"
echo "  5. Exécutez: docker compose -f docker-compose.prod.yml up -d"
echo ""


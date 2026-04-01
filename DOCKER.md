# 🐳 Docker & Railway Deployment Guide

Ce guide explique comment démarrer et gérer la plateforme en utilisant Docker Compose pour les tests locaux et Railway pour la production.

## 📋 Prérequis

- Docker (20.10+)
- Docker Compose (v2.0+)
- Identifiants LiveKit Cloud (URL, API Key, API Secret)
- Clé API OpenAI

## 🚀 Démarrage Rapide (Local)

### 1. Configuration de l'Environnement
Copiez le fichier d'exemple et remplissez vos identifiants :
```bash
cp .env.example .env
```

### 2. Démarrer les Services
```bash
docker-compose up -d
```
Cette commande va :
- Construire les images Docker pour l'**Agent** et l'**Application Web**.
- Démarrer les deux services en arrière-plan.
- Créer un réseau partagé (`tcf-network`) pour la communication.

### 3. Vérifier le Déploiement
```bash
docker-compose ps
```
L'interface web sera accessible sur `http://localhost:3000`.

## 🛠️ Commandes Courantes

| Tâche | Commande |
| --- | --- |
| Voir tous les logs | `docker-compose logs -f` |
| Voir les logs de l'agent | `docker-compose logs -f agent` |
| Arrêter les services | `docker-compose stop` |
| Supprimer les conteneurs | `docker-compose down` |
| Reconstruire & redémarrer | `docker-compose up -d --build` |

---

## ☁️ Déploiement sur Railway (Recommandé)

Le projet est optimisé pour Railway avec une stratégie "Scale-to-Zero".

### 1. Configuration des Services
Créez deux services Railway à partir du même dépôt GitHub :

- **Service Web** : Réglez le **Config File Path** sur `apps/web/railway.json`.
- **Service Agent** : Réglez le **Config File Path** sur `apps/agent/railway.json`.

**IMPORTANT** : Ne modifiez PAS le **Root Directory**. Laissez-le vide (racine du projet).

### 2. Variables d'Environnement (Dashboard Railway)
Configurez les variables suivantes dans le tableau de bord Railway pour chaque service :

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY` (Agent uniquement)
- `AGENT_WAKE_URL` (Web uniquement, ex: `http://agent.railway.internal:8080`)

## 🏗️ Architecture des Services
- **Agent (`tcf-agent`)** : Service interne. Communique avec LiveKit et OpenAI.
- **Web (`tcf-web`)** : Service public. Exposé sur le port 3000.

Pour plus de détails techniques, consultez [AGENTS.md](./AGENTS.md).

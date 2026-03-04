import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { AgentConfig, ServiceConfig, TaskType } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache pour les configurations chargées
const configCache = new Map<TaskType, AgentConfig>();
let serviceConfigCache: ServiceConfig | null = null;

/**
 * Charge la configuration d'un agent depuis un fichier YAML
 * @param taskType Le type de tâche (tache1, tache2, tache3)
 * @returns La configuration de l'agent
 */
export function loadAgentConfig(taskType: TaskType): AgentConfig {
  // Vérifier si la configuration est déjà en cache
  if (configCache.has(taskType)) {
    return configCache.get(taskType)!;
  }

  try {
    // Construire le chemin vers le fichier de configuration
    const configPath = join(__dirname, '..', '..', 'config', 'agents', `${taskType}.yml`);

    // Lire le fichier YAML
    const fileContent = readFileSync(configPath, 'utf-8');

    // Parser le contenu YAML
    const config = parse(fileContent) as AgentConfig;

    // Valider la configuration
    validateConfig(config, taskType);

    // Mettre en cache
    configCache.set(taskType, config);

    console.log(`✓ Configuration loaded for ${taskType}: ${config.name}`);

    return config;
  } catch (error) {
    console.error(`Error loading configuration for ${taskType}:`, error);
    throw new Error(`Failed to load configuration for ${taskType}`);
  }
}

/**
 * Valide que la configuration contient tous les champs requis
 */
function validateConfig(config: AgentConfig, taskType: TaskType): void {
  const requiredFields = [
    'name',
    'description',
    'settings',
    'durations',
    'baseInstructions',
    'instructions',
    'greeting',
  ];

  for (const field of requiredFields) {
    if (!(field in config)) {
      throw new Error(`Missing required field '${field}' in ${taskType} configuration`);
    }
  }
}

/**
 * Nettoie le cache des configurations (utile pour les tests)
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Recharge une configuration depuis le fichier (ignore le cache)
 */
export function reloadAgentConfig(taskType: TaskType): AgentConfig {
  configCache.delete(taskType);
  return loadAgentConfig(taskType);
}

/**
 * Charge la configuration du service depuis service.yml
 * @returns La configuration du service
 */
export function loadServiceConfig(): ServiceConfig {
  // Vérifier si la configuration est déjà en cache
  if (serviceConfigCache) {
    return serviceConfigCache;
  }

  try {
    // Construire le chemin vers le fichier de configuration
    const configPath = join(__dirname, '..', '..', 'config', 'service.yml');

    // Lire le fichier YAML
    const fileContent = readFileSync(configPath, 'utf-8');

    // Parser le contenu YAML
    const config = parse(fileContent) as ServiceConfig;

    // Valider la configuration
    validateServiceConfig(config);

    // Mettre en cache
    serviceConfigCache = config;

    console.log(`✓ Service configuration loaded`);

    return config;
  } catch (error) {
    console.error('Error loading service configuration:', error);
    throw new Error('Failed to load service configuration');
  }
}

/**
 * Valide que la configuration du service contient tous les champs requis
 */
function validateServiceConfig(config: ServiceConfig): void {
  if (!config.llm || !config.llm.voice || !config.llm.modalities) {
    throw new Error('Missing required LLM configuration');
  }

  if (!config.session || config.session.metricsEnabled === undefined) {
    throw new Error('Missing required session configuration');
  }

  if (!config.connection || !config.connection.participantWaitTime) {
    throw new Error('Missing required connection configuration');
  }
}

/**
 * Recharge la configuration du service depuis le fichier (ignore le cache)
 */
export function reloadServiceConfig(): ServiceConfig {
  serviceConfigCache = null;
  return loadServiceConfig();
}

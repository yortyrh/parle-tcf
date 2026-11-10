import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { Injectable, Logger } from '@nestjs/common';
import type { TaskType } from '@parle-tcf/shared';
import { getApiConfigDir } from '../paths.js';

export interface AgentYamlConfig {
  name: string;
  description: string;
  settings: {
    allowInterruptions: boolean;
    voice?: string;
  };
  baseInstructions: string;
  instructions: string;
  greeting: string;
}

/** Parsed `service.yml`. Only `llm.model` and `llm.voice` are read for Realtime session creation. */
export interface ServiceYamlConfig {
  llm: {
    provider?: string;
    model: string;
    voice: string;
    modalities?: string[];
  };
}

@Injectable()
export class ExamConfigService {
  private readonly logger = new Logger(ExamConfigService.name);
  private readonly agentCache = new Map<TaskType, AgentYamlConfig>();
  private serviceCache: ServiceYamlConfig | null = null;
  private readonly markdownCache = new Map<string, string>();

  private getConfigDir(): string {
    return getApiConfigDir();
  }

  loadAgentConfig(taskType: TaskType): AgentYamlConfig {
    const cached = this.agentCache.get(taskType);
    if (cached) return cached;
    const configPath = join(this.getConfigDir(), 'agents', `${taskType}.yml`);
    const fileContent = readFileSync(configPath, 'utf-8');
    const config = parse(fileContent) as AgentYamlConfig;
    this.validateAgent(config, taskType);
    this.agentCache.set(taskType, config);
    this.logger.log(`Loaded agent YAML: ${taskType}`);
    return config;
  }

  loadServiceConfig(): ServiceYamlConfig {
    if (this.serviceCache) return this.serviceCache;
    const configPath = join(this.getConfigDir(), 'service.yml');
    const fileContent = readFileSync(configPath, 'utf-8');
    const config = parse(fileContent) as ServiceYamlConfig;
    if (!config.llm?.voice || !config.llm?.model) {
      throw new Error('service.yml: missing llm.voice or llm.model');
    }
    this.serviceCache = config;
    return config;
  }

  /**
   * Loads an auxiliary markdown file from `config/info/`. Cached per-path.
   * Returns `undefined` (and logs a warning) if the file is missing, so callers
   * can degrade gracefully when an optional reference document is absent.
   */
  loadInfoMarkdown(filename: string): string | undefined {
    const cached = this.markdownCache.get(filename);
    if (cached !== undefined) return cached;
    const filePath = join(this.getConfigDir(), 'info', filename);
    try {
      const content = readFileSync(filePath, 'utf-8');
      this.markdownCache.set(filename, content);
      return content;
    } catch (err) {
      this.logger.warn(`Could not load info markdown '${filename}': ${(err as Error).message}`);
      return undefined;
    }
  }

  private validateAgent(config: AgentYamlConfig, taskType: TaskType): void {
    const required = [
      'name',
      'description',
      'settings',
      'baseInstructions',
      'instructions',
      'greeting',
    ] as const;
    for (const field of required) {
      if (!(field in config)) {
        throw new Error(`Missing '${field}' in ${taskType}.yml`);
      }
    }
  }
}

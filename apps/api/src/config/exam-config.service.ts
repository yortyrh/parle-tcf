import { Injectable, Logger } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { TaskType } from "@yorty-tcf/shared";
import { getApiConfigDir } from "../paths.js";

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

export interface ServiceYamlConfig {
  llm: {
    provider: string;
    model: string;
    voice: string;
    modalities: string[];
  };
  session: {
    metricsEnabled: boolean;
    inputOptions: { noiseCancellation: string };
  };
  connection: {
    participantWaitTime: number;
    participantJoinPollIntervalMs?: number;
    disconnectDelay: number;
  };
  endExamMessage: { instructions: string };
}

@Injectable()
export class ExamConfigService {
  private readonly logger = new Logger(ExamConfigService.name);
  private readonly agentCache = new Map<TaskType, AgentYamlConfig>();
  private serviceCache: ServiceYamlConfig | null = null;

  private getConfigDir(): string {
    return getApiConfigDir();
  }

  loadAgentConfig(taskType: TaskType): AgentYamlConfig {
    const cached = this.agentCache.get(taskType);
    if (cached) return cached;
    const configPath = join(this.getConfigDir(), "agents", `${taskType}.yml`);
    const fileContent = readFileSync(configPath, "utf-8");
    const config = parse(fileContent) as AgentYamlConfig;
    this.validateAgent(config, taskType);
    this.agentCache.set(taskType, config);
    this.logger.log(`Loaded agent YAML: ${taskType}`);
    return config;
  }

  loadServiceConfig(): ServiceYamlConfig {
    if (this.serviceCache) return this.serviceCache;
    const configPath = join(this.getConfigDir(), "service.yml");
    const fileContent = readFileSync(configPath, "utf-8");
    const config = parse(fileContent) as ServiceYamlConfig;
    if (!config.llm?.voice || !config.llm?.model) {
      throw new Error("service.yml: missing llm.voice or llm.model");
    }
    this.serviceCache = config;
    return config;
  }

  private validateAgent(config: AgentYamlConfig, taskType: TaskType): void {
    const required = [
      "name",
      "description",
      "settings",
      "baseInstructions",
      "instructions",
      "greeting",
    ] as const;
    for (const field of required) {
      if (!(field in config)) {
        throw new Error(`Missing '${field}' in ${taskType}.yml`);
      }
    }
  }
}

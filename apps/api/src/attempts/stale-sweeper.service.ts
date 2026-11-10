import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { EvaluationService } from '../evaluation/evaluation.service.js';
import { AttemptsService } from './attempts.service.js';

export const SWEEP_INTERVAL_MS = 5 * 60_000;

/**
 * Periodic cleanup of work a crash or a closed tab left behind: evaluations
 * stuck in `running` become `failed` (requeueable) and silent in-progress
 * attempts become `interrupted`. Runs at boot, then every SWEEP_INTERVAL_MS.
 */
@Injectable()
export class StaleSweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StaleSweeperService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly evaluation: EvaluationService,
    private readonly attempts: AttemptsService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.sweep();
    this.timer = setInterval(() => {
      this.sweep().catch((error: unknown) => this.logger.error(`Sweep failed: ${String(error)}`));
    }, SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async sweep(now = new Date()): Promise<void> {
    await this.evaluation.failStale(now);
    await this.attempts.interruptStale(now);
  }
}

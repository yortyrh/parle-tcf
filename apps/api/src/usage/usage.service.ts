import { Inject, Injectable } from "@nestjs/common";
import { ORPCError } from "@orpc/server";
import {
  and,
  eq,
  examAttempts,
  gte,
  sql,
  usageLimits,
  type Database,
} from "@parle-tcf/db";
import type { Usage } from "@parle-tcf/shared";
import { DATABASE } from "../database/database.tokens.js";

const DEFAULT_DAILY_MINUTES = 60;
const DEFAULT_MONTHLY_COST_USD = 10;

function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Daily minutes and monthly cost caps (per user, overridable per row). Days and
 * months are UTC, whatever the server time zone. Today's minutes include the
 * sessions still in progress, up to their last sign of life.
 */
@Injectable()
export class UsageService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async get(userId: string, now = new Date()): Promise<Usage> {
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const [[today], [month], [limits]] = await Promise.all([
      this.db
        .select({
          minutes: sql<string>`coalesce(sum(case
            when ${examAttempts.status} = 'in_progress'
              then greatest(extract(epoch from (${examAttempts.lastActivityAt} - ${examAttempts.startedAt})), 0) / 60
            else coalesce(${examAttempts.realtimeMinutes}, 0)
          end), 0)`,
        })
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.userId, userId),
            gte(examAttempts.startedAt, startOfDay),
          ),
        ),
      this.db
        .select({
          cost: sql<string>`coalesce(sum(${examAttempts.estimatedCostUsd}), 0)`,
        })
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.userId, userId),
            gte(examAttempts.startedAt, startOfMonth),
          ),
        ),
      this.db
        .select()
        .from(usageLimits)
        .where(eq(usageLimits.userId, userId))
        .limit(1),
    ]);

    return {
      todayMinutes: Number(today?.minutes ?? 0),
      dailyMinutesLimit:
        limits?.dailyMinutes ??
        envNumber("DEFAULT_DAILY_MINUTES", DEFAULT_DAILY_MINUTES),
      monthCostUsd: Number(month?.cost ?? 0),
      monthlyCostLimitUsd: limits
        ? Number(limits.monthlyCostUsd)
        : envNumber("DEFAULT_MONTHLY_COST_USD", DEFAULT_MONTHLY_COST_USD),
    };
  }

  /** Same rule as assertWithinLimits, as a flag (checkpoints of a live session). */
  async isOverLimit(userId: string, now = new Date()): Promise<boolean> {
    const usage = await this.get(userId, now);
    return (
      usage.todayMinutes >= usage.dailyMinutesLimit ||
      usage.monthCostUsd >= usage.monthlyCostLimitUsd
    );
  }

  async assertWithinLimits(userId: string): Promise<void> {
    const usage = await this.get(userId);
    if (usage.todayMinutes >= usage.dailyMinutesLimit) {
      throw new ORPCError("LIMIT_REACHED", {
        status: 429,
        message: `Limite quotidienne atteinte (${usage.dailyMinutesLimit} min). Réessayez demain.`,
      });
    }
    if (usage.monthCostUsd >= usage.monthlyCostLimitUsd) {
      throw new ORPCError("LIMIT_REACHED", {
        status: 429,
        message: `Limite mensuelle de coût atteinte (${usage.monthlyCostLimitUsd} $).`,
      });
    }
  }
}

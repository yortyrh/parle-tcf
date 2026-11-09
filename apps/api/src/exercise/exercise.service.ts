import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TaskType } from "@parle-tcf/shared";
import { getApiConfigDir } from "../paths.js";

export interface TcfExerciseRow {
  id: string;
  taskType: "Tâche 2" | "Tâche 3";
  content: string;
  consigne?: string;
  url?: string;
  imageUrl?: string;
  imagePath?: string;
  isImageBased: boolean;
}

interface ExerciseRow {
  id: string;
  taskType: string;
  content: string;
  url: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  isImageBased: number;
}

@Injectable()
export class ExerciseService implements OnModuleDestroy {
  private readonly logger = new Logger(ExerciseService.name);
  private db: Database.Database | null = null;

  private getConfigDir(): string {
    return getApiConfigDir();
  }

  private getDb(): Database.Database {
    if (!this.db) {
      const dbPath = join(this.getConfigDir(), "tcf-exercises.db");
      if (!existsSync(dbPath)) {
        this.logger.warn(`SQLite not found at ${dbPath}; run pnpm generate-db`);
      }
      this.db = new Database(dbPath, { readonly: true, fileMustExist: false });
    }
    return this.db;
  }

  onModuleDestroy(): void {
    this.db?.close();
    this.db = null;
  }

  private rowToExercise(row: ExerciseRow): TcfExerciseRow {
    const exercise: TcfExerciseRow = {
      id: row.id,
      taskType: row.taskType as "Tâche 2" | "Tâche 3",
      content: row.content,
      isImageBased: row.isImageBased === 1,
    };
    if (row.url) exercise.url = row.url;
    if (row.imageUrl) exercise.imageUrl = row.imageUrl;
    if (row.imagePath) exercise.imagePath = row.imagePath;
    return exercise;
  }

  getRandomTcfExercise(taskType: "tache2" | "tache3"): TcfExerciseRow | null {
    try {
      const label = taskType === "tache2" ? "Tâche 2" : "Tâche 3";
      const stmt = this.getDb().prepare<[string], ExerciseRow>(
        "SELECT * FROM exercises WHERE taskType = ? ORDER BY RANDOM() LIMIT 1",
      );
      const row = stmt.get(label);
      if (!row) {
        this.logger.warn(`No exercises found for ${taskType}`);
        return null;
      }
      return this.rowToExercise(row);
    } catch (e) {
      this.logger.error(`getRandomTcfExercise ${taskType}`, e);
      return null;
    }
  }

  listOrderedExerciseIds(taskType: TaskType): string[] {
    if (taskType === "tache1") {
      return [];
    }
    if (taskType === "tache2" || taskType === "tache3") {
      const label = taskType === "tache2" ? "Tâche 2" : "Tâche 3";
      try {
        const stmt = this.getDb().prepare<[string], { id: string }>(
          "SELECT id FROM exercises WHERE taskType = ? ORDER BY LENGTH(id), id",
        );
        const rows = stmt.all(label);
        return rows.map((r) => r.id);
      } catch (e) {
        this.logger.error(`listOrderedExerciseIds ${taskType}`, e);
        return [];
      }
    }
    return [];
  }

  getExerciseById(id: string): TcfExerciseRow | null {
    try {
      const stmt = this.getDb().prepare<[string], ExerciseRow>(
        "SELECT * FROM exercises WHERE id = ?",
      );
      const row = stmt.get(id);
      if (!row) return null;
      return this.rowToExercise(row);
    } catch (e) {
      this.logger.error(`getExerciseById ${id}`, e);
      return null;
    }
  }

  resolveExerciseForTask(
    taskType: TaskType,
    exerciseId?: string,
  ): TcfExerciseRow | null {
    if (taskType === "tache1") {
      return null;
    }
    if (taskType === "tache2") {
      const ex = exerciseId
        ? this.getExerciseById(exerciseId)
        : this.getRandomTcfExercise("tache2");
      return ex;
    }
    if (taskType === "tache3") {
      const ex = exerciseId
        ? this.getExerciseById(exerciseId)
        : this.getRandomTcfExercise("tache3");
      return ex;
    }
    return null;
  }
}

import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Database from "better-sqlite3";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { TaskType } from "@yorty-tcf/shared";
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

export interface TefExercise {
  id: string;
  section: "A" | "B";
  filename: string;
  /** Agent prompt from `TEF-*-NN.instructions.md`. */
  instructions: string;
  /** Candidate guide from `TEF-*-NN.conseils.md` or section default. Never sent to the agent. */
  practiceGuide: string | null;
}

/** Per-exercise agent prompt file (paired with `.conseils.md` + `.png`). */
const TEF_INSTRUCTIONS_MD = /^TEF-[AB]-\d{2}\.instructions\.md$/i;

@Injectable()
export class ExerciseService implements OnModuleDestroy {
  private readonly logger = new Logger(ExerciseService.name);
  private db: Database.Database | null = null;
  private tefCache: TefExercise[] | null = null;
  private defaultGuideCache: Partial<Record<"A" | "B", string>> = {};

  private getConfigDir(): string {
    return getApiConfigDir();
  }

  private loadDefaultPracticeGuide(section: "A" | "B"): string | null {
    if (this.defaultGuideCache[section] !== undefined) {
      return this.defaultGuideCache[section] ?? null;
    }
    const path = join(
      this.getConfigDir(),
      "tef-exercices",
      `TEF-${section}`,
      "_default-practice-guide.md",
    );
    if (!existsSync(path)) {
      this.defaultGuideCache[section] = undefined;
      return null;
    }
    try {
      const content = readFileSync(path, "utf-8").trim();
      this.defaultGuideCache[section] = content || undefined;
      return content || null;
    } catch (e) {
      this.logger.error(
        `read _default-practice-guide.md section ${section}`,
        e,
      );
      this.defaultGuideCache[section] = undefined;
      return null;
    }
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
    if (taskType === "tef-section-a") {
      return this.loadTefExercises()
        .filter((ex) => ex.section === "A")
        .map((ex) => ex.id);
    }
    if (taskType === "tef-section-b") {
      return this.loadTefExercises()
        .filter((ex) => ex.section === "B")
        .map((ex) => ex.id);
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

  private loadTefExercises(): TefExercise[] {
    if (this.tefCache) return this.tefCache;
    const exercises: TefExercise[] = [];
    const root = join(this.getConfigDir(), "tef-exercices");

    for (const section of ["A", "B"] as const) {
      const dir = join(root, `TEF-${section}`);
      if (!existsSync(dir)) {
        this.logger.warn(`TEF folder missing: ${dir}`);
        continue;
      }
      const mdNames = readdirSync(dir)
        .filter((f) => TEF_INSTRUCTIONS_MD.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      for (const mdName of mdNames) {
        const base = mdName.replace(/\.instructions\.md$/i, "");
        const pngName = `${base}.png`;
        const pngPath = join(dir, pngName);
        if (!existsSync(pngPath)) {
          this.logger.warn(`Skipping ${mdName}: missing ${pngName}`);
          continue;
        }
        try {
          const instructions = readFileSync(join(dir, mdName), "utf-8").trim();
          const conseilsPath = join(dir, `${base}.conseils.md`);
          let inlineGuide: string | null = null;
          if (existsSync(conseilsPath)) {
            inlineGuide = readFileSync(conseilsPath, "utf-8").trim() || null;
          }
          const practiceGuide =
            inlineGuide ?? this.loadDefaultPracticeGuide(section);
          exercises.push({
            id: base,
            section,
            filename: pngName,
            instructions,
            practiceGuide,
          });
        } catch (e) {
          this.logger.error(`read ${mdName}`, e);
        }
      }
    }

    if (exercises.length === 0) {
      this.logger.warn(
        "No TEF exercises found; add TEF-A-NN.instructions.md, TEF-A-NN.conseils.md, TEF-A-NN.png under config/tef-exercices/",
      );
    }

    this.tefCache = exercises;
    return this.tefCache;
  }

  getTefExercise(section: "A" | "B", exerciseId?: string): TefExercise {
    const all = this.loadTefExercises();
    const filtered = all.filter((ex) => ex.section === section);
    if (filtered.length === 0) {
      return {
        id: `TEF-${section}-00`,
        section,
        filename: `TEF-${section}-01.png`,
        instructions:
          section === "A"
            ? "Vous téléphonez pour obtenir des informations sur cette annonce."
            : "Vous présentez cette annonce à un(e) ami(e) et essayez de le/la convaincre.",
        practiceGuide: this.loadDefaultPracticeGuide(section),
      };
    }
    if (exerciseId) {
      const normalized = exerciseId.trim();
      const found = filtered.find(
        (ex) =>
          ex.id === normalized ||
          ex.id.toLowerCase() === normalized.toLowerCase(),
      );
      if (found) return found;
      this.logger.warn(
        `TEF exercise not found: ${exerciseId} (section ${section})`,
      );
    }
    const randomIndex = Math.floor(Math.random() * filtered.length);
    return filtered[randomIndex]!;
  }

  resolveExerciseForTask(
    taskType: TaskType,
    exerciseId?: string,
  ): { tcf: TcfExerciseRow | null; tef: TefExercise | null } {
    if (taskType === "tache1") {
      return { tcf: null, tef: null };
    }
    if (taskType === "tache2") {
      const ex = exerciseId
        ? this.getExerciseById(exerciseId)
        : this.getRandomTcfExercise("tache2");
      return { tcf: ex, tef: null };
    }
    if (taskType === "tache3") {
      const ex = exerciseId
        ? this.getExerciseById(exerciseId)
        : this.getRandomTcfExercise("tache3");
      return { tcf: ex, tef: null };
    }
    if (taskType === "tef-section-a") {
      return { tcf: null, tef: this.getTefExercise("A", exerciseId) };
    }
    if (taskType === "tef-section-b") {
      return { tcf: null, tef: this.getTefExercise("B", exerciseId) };
    }
    return { tcf: null, tef: null };
  }
}

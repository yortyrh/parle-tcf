/**
 * Writes `TEF-A-NN.instructions.md` / `TEF-B-NN.instructions.md` (Realtime agent prompt:
 * YAML from tef-section-{a|b}.yml + EXERCICE À UTILISER + vision body from PNG).
 *
 * Conseils (candidate tab) are generated separately: `generate-tef-conseils`.
 *
 * Usage:
 *   pnpm generate-tef-instructions
 *   pnpm generate-tef-instructions -- --force
 *   pnpm generate-tef-instructions -- --upgrade   (re-merge YAML + existing exercise body, no vision)
 *   pnpm generate-tef-instructions -- --only TEF-A-01 TEF-B-02
 *   pnpm generate-tef-instructions -- --model gpt-4o
 *   pnpm generate-tef-instructions -- --stub      (placeholders without OPENAI_API_KEY)
 */
import dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import OpenAI from "openai";
import {
  extractExerciseBodyFromInstructionsFile,
  generateExerciseFragmentForImage,
  getGenericRulesPrefix,
  listStandardPngs,
  parseTefGenCliArgs,
  pathForInstructions,
  stubExerciseFragment,
  wrapInstructionsPrompt,
} from "./tef-generation-shared.js";

dotenv.config({ path: ".env.local" });

async function main(): Promise<void> {
  const { force, only, model, stub, upgrade } = parseTefGenCliArgs(
    process.argv.slice(2),
    { allowUpgrade: true },
  );

  if (stub && upgrade) {
    console.error("Use only one of --stub or --upgrade.");
    process.exit(1);
  }

  if (stub) {
    for (const section of ["A", "B"] as const) {
      getGenericRulesPrefix(section);
      for (const filename of listStandardPngs(section)) {
        const base = basename(filename, ".png");
        const id = base.toUpperCase();
        if (only && !only.has(id)) continue;
        const outPath = pathForInstructions(section, base);
        if (existsSync(outPath) && !force) {
          console.log(`Skip stub ${id} (exists)`);
          continue;
        }
        const full = wrapInstructionsPrompt(stubExerciseFragment(id, section), section);
        writeFileSync(outPath, full, "utf-8");
        console.log(`Stub ${id}`);
      }
    }
    console.log("Stub pass done.");
    return;
  }

  if (upgrade) {
    let count = 0;
    for (const section of ["A", "B"] as const) {
      getGenericRulesPrefix(section);
      for (const filename of listStandardPngs(section)) {
        const base = basename(filename, ".png");
        const id = base.toUpperCase();
        if (only && !only.has(id)) continue;
        const instPath = pathForInstructions(section, base);
        if (!existsSync(instPath)) {
          console.log(`Skip upgrade ${id} (no .instructions.md)`);
          continue;
        }
        const raw = readFileSync(instPath, "utf-8");
        const exerciseBody = extractExerciseBodyFromInstructionsFile(raw);
        const full = wrapInstructionsPrompt(exerciseBody, section);
        writeFileSync(instPath, full, "utf-8");
        console.log(`Upgrade ${id}`);
        count++;
      }
    }
    console.log(`Upgrade done (${count} file(s)).`);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "OPENAI_API_KEY not found. Use --stub for placeholders or set .env.local",
    );
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  type Job = { section: "A" | "B"; filename: string; id: string; base: string };
  const jobs: Job[] = [];

  for (const section of ["A", "B"] as const) {
    getGenericRulesPrefix(section);
    for (const filename of listStandardPngs(section)) {
      const base = basename(filename, ".png");
      const id = base.toUpperCase();
      if (only && !only.has(id)) continue;
      const outPath = pathForInstructions(section, base);
      if (existsSync(outPath) && !force) {
        console.log(`Skip ${id} (exists, use --force)`);
        continue;
      }
      jobs.push({ section, filename, id, base });
    }
  }

  if (jobs.length === 0) {
    console.log("Nothing to generate.");
    return;
  }

  console.log(`Generating ${jobs.length} instruction file(s) with model ${model}…`);

  for (const { section, filename, id, base } of jobs) {
    const outPath = pathForInstructions(section, base);
    try {
      console.log(`  ${id} — generating exercise…`);
      const fragment = await generateExerciseFragmentForImage(
        client,
        section,
        filename,
        model,
      );
      const full = wrapInstructionsPrompt(fragment, section);
      writeFileSync(outPath, full, "utf-8");
      console.log(`  ✓ ${id}`);
    } catch (e) {
      console.error(`  ✗ ${id}`, e);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("Done.");
}

main().catch(console.error);

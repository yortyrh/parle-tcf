/**
 * Writes `TEF-A-NN.instructions.md` / `TEF-B-NN.instructions.md` (Realtime system prompt as plain text).
 * Generation: Responses API with `gpt-5.5`, reasoning effort `medium`, image + meta-question → JSON `{ prompt }` written as the full `*.instructions.md`.
 *
 * Conseils (candidate tab): `generate-tef-conseils`.
 *
 * Usage:
 *   pnpm generate-tef-instructions
 *   pnpm generate-tef-instructions -- --force
 *   pnpm generate-tef-instructions -- --only TEF-A-01 TEF-B-02
 *   pnpm generate-tef-instructions -- --model gpt-5.5
 *   pnpm generate-tef-instructions -- --stub      (placeholders without OPENAI_API_KEY)
 */
import dotenv from "dotenv";
import { existsSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import OpenAI from "openai";
import {
  generateTefInstructionsForImage,
  listStandardPngs,
  parseTefGenCliArgs,
  pathForInstructions,
  stubExerciseFragment,
} from "./tef-generation-shared.js";

dotenv.config({ path: ".env.local" });

async function main(): Promise<void> {
  const { force, only, model, stub } = parseTefGenCliArgs(
    process.argv.slice(2),
  );

  if (stub) {
    for (const section of ["A", "B"] as const) {
      for (const filename of listStandardPngs(section)) {
        const base = basename(filename, ".png");
        const id = base.toUpperCase();
        if (only && !only.has(id)) continue;
        const outPath = pathForInstructions(section, base);
        if (existsSync(outPath) && !force) {
          console.log(`Skip stub ${id} (exists)`);
          continue;
        }
        writeFileSync(
          outPath,
          stubExerciseFragment(id, section).trim(),
          "utf-8",
        );
        console.log(`Stub ${id}`);
      }
    }
    console.log("Stub pass done.");
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
      console.log(`  ${id} — generating…`);
      const markdown = await generateTefInstructionsForImage(
        client,
        section,
        filename,
        model,
      );
      writeFileSync(outPath, markdown.trim(), "utf-8");
      console.log(`  ✓ ${id}`);
    } catch (e) {
      console.error(`  ✗ ${id}`, e);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("Done.");
}

main().catch(console.error);

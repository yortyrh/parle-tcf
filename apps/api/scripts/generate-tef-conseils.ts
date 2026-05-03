/**
 * Writes `TEF-A-NN.conseils.md` / `TEF-B-NN.conseils.md` (candidate-facing guide from vision on PNG).
 * Does not touch agent instructions — use `generate-tef-instructions` for those.
 *
 * Usage:
 *   pnpm generate-tef-conseils
 *   pnpm generate-tef-conseils -- --force
 *   pnpm generate-tef-conseils -- --only TEF-A-01 TEF-B-02
 *   pnpm generate-tef-conseils -- --model gpt-4o
 *   pnpm generate-tef-conseils -- --stub   (placeholder files without OPENAI_API_KEY)
 */
import dotenv from "dotenv";
import { existsSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import OpenAI from "openai";
import {
  generatePracticeGuideForImage,
  listStandardPngs,
  parseTefGenCliArgs,
  pathForConseils,
  stubConseilsMarkdown,
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
        const outPath = pathForConseils(section, base);
        if (existsSync(outPath) && !force) {
          console.log(`Skip stub ${id} (exists)`);
          continue;
        }
        const body = stubConseilsMarkdown(id, section);
        writeFileSync(
          outPath,
          body + (body.endsWith("\n") ? "" : "\n"),
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
      const outPath = pathForConseils(section, base);
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

  console.log(`Generating ${jobs.length} conseils file(s) with model ${model}…`);

  for (const { section, filename, id, base } of jobs) {
    const outPath = pathForConseils(section, base);
    try {
      console.log(`  ${id} — generating conseils…`);
      const guide = await generatePracticeGuideForImage(
        client,
        section,
        filename,
        model,
      );
      writeFileSync(
        outPath,
        guide + (guide.endsWith("\n") ? "" : "\n"),
        "utf-8",
      );
      console.log(`  ✓ ${id}`);
    } catch (e) {
      console.error(`  ✗ ${id}`, e);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("Done.");
}

main().catch(console.error);

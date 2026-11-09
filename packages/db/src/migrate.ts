import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client";

/** Absolute path of the SQL migrations shipped with this package. */
export const MIGRATIONS_FOLDER = path.resolve(__dirname, "..", "migrations");

export async function runMigrations(url: string): Promise<void> {
  const handle = createDb({ url, max: 1 });
  try {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await handle.close();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log("Database migrations applied"))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}

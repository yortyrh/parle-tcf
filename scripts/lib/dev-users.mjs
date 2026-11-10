/**
 * Local development users seeded by `pnpm samples:seed`. Passwords are generated
 * per machine and kept in the gitignored `.samples/local-credentials.json`
 * (`pnpm local:credentials` prints them). Pure functions: no I/O.
 */

export const DEV_USERS = Object.freeze([
  Object.freeze({
    key: "developer",
    email: "developer@parle-tcf.local",
    name: "Développeur",
  }),
  Object.freeze({
    key: "e2e",
    email: "e2e-fixture@parle-tcf.local",
    name: "E2E Fixture",
  }),
]);

const MIN_PASSWORD_LENGTH = 12;

/**
 * Keeps previously generated passwords and generates the missing ones.
 * @param {unknown} previous parsed local-credentials.json (any shape)
 * @param {() => string} generate
 */
export function resolveCredentials(previous, generate) {
  const stored =
    previous && typeof previous === "object" && "credentials" in previous
      ? /** @type {{ credentials: unknown }} */ (previous).credentials
      : null;
  const known =
    stored && typeof stored === "object"
      ? /** @type {Record<string, unknown>} */ (stored)
      : {};

  /** @type {Record<string, string>} */
  const credentials = {};
  /** @type {string[]} */
  const generated = [];
  for (const { email } of DEV_USERS) {
    const existing = known[email];
    if (
      typeof existing === "string" &&
      existing.length >= MIN_PASSWORD_LENGTH
    ) {
      credentials[email] = existing;
    } else {
      credentials[email] = generate();
      generated.push(email);
    }
  }
  return { credentials, generated };
}

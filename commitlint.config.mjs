export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // No AI/co-author attribution trailers (see .claude/skills/commit).
    "trailer-exists": [2, "never", "Co-Authored-By:"],
  },
};

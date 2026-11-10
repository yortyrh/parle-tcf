import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findUnverifiedUpdates,
  parsePrePushInput,
  readStamp,
  writeStamp,
} from "./push-stamp.mjs";

const A = "a".repeat(40);
const B = "b".repeat(40);
const TAG = "c".repeat(40);
const ZERO = "0".repeat(40);

const peel = (sha) => ({ [A]: A, [B]: B, [TAG]: A })[sha] ?? null;

describe("parsePrePushInput", () => {
  it("parses one update per line and ignores blank lines", () => {
    const input = `refs/heads/main ${A} refs/heads/main ${B}\n\nrefs/tags/v1 ${TAG} refs/tags/v1 ${ZERO}\n`;
    expect(parsePrePushInput(input)).toEqual([
      {
        localRef: "refs/heads/main",
        localSha: A,
        remoteRef: "refs/heads/main",
        remoteSha: B,
      },
      {
        localRef: "refs/tags/v1",
        localSha: TAG,
        remoteRef: "refs/tags/v1",
        remoteSha: ZERO,
      },
    ]);
  });

  it("returns no updates for empty input", () => {
    expect(parsePrePushInput("")).toEqual([]);
  });
});

describe("findUnverifiedUpdates", () => {
  const update = (localSha, localRef = "refs/heads/main") => ({
    localRef,
    localSha,
    remoteRef: localRef,
    remoteSha: ZERO,
  });

  it("allows the verified commit, including annotated tags that point to it", () => {
    expect(
      findUnverifiedUpdates([update(A), update(TAG, "refs/tags/v1")], A, peel),
    ).toEqual([]);
  });

  it("blocks commits other than the verified one", () => {
    expect(
      findUnverifiedUpdates(
        [update(A), update(B, "refs/heads/other")],
        A,
        peel,
      ),
    ).toEqual([update(B, "refs/heads/other")]);
  });

  it("blocks every update when nothing has been verified", () => {
    expect(findUnverifiedUpdates([update(A)], null, peel)).toEqual([update(A)]);
  });

  it("blocks objects that do not resolve to a commit", () => {
    const unknown = "d".repeat(40);
    expect(findUnverifiedUpdates([update(unknown)], A, peel)).toEqual([
      update(unknown),
    ]);
  });

  it("always allows deletions", () => {
    expect(findUnverifiedUpdates([update(ZERO)], null, peel)).toEqual([]);
  });
});

describe("stamp file", () => {
  const dir = mkdtempSync(join(tmpdir(), "push-stamp-"));

  it("round-trips the verified commit", () => {
    const path = join(dir, "nested", "stamp");
    writeStamp(A, path);
    expect(readStamp(path)).toBe(A);
  });

  it("reads a missing or malformed stamp as null", () => {
    expect(readStamp(join(dir, "missing"))).toBeNull();
    const broken = join(dir, "broken");
    writeFileSync(broken, "not json");
    expect(readStamp(broken)).toBeNull();
  });
});

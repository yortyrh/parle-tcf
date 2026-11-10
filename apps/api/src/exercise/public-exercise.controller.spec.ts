import { describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants.js";
import { call } from "@orpc/server";
import type { FeaturedExercises } from "@parle-tcf/shared";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { ExerciseController } from "./exercise.controller.js";
import type { ExerciseService } from "./exercise.service.js";
import { PublicExerciseController } from "./public-exercise.controller.js";

const FEATURED: FeaturedExercises = {
  session: { id: 7, year: 2025, month: 12, tache2: 4, tache3: 2 },
  items: [
    {
      id: "t2-a",
      task: 2,
      prompt: "Je suis votre voisin.",
      firstSeenOn: "2025-12-01",
      lastSeenOn: "2025-12-01",
      timesPublished: 2,
      isImageBased: false,
    },
    {
      id: "t3-a",
      task: 3,
      prompt: "Faut-il interdire les voitures en ville ?",
      firstSeenOn: null,
      lastSeenOn: null,
      timesPublished: 0,
      isImageBased: false,
    },
  ],
};

const make = (result: FeaturedExercises) => {
  const service = { featured: vi.fn(async () => result) };
  const controller = new PublicExerciseController(
    service as unknown as ExerciseService,
  );
  return { service, controller };
};

const guardsOf = (target: object): unknown[] =>
  (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? [];

describe("PublicExerciseController", () => {
  it("returns what featured() returns", async () => {
    const { service, controller } = make(FEATURED);
    expect(await call(controller.featured(), {})).toEqual(FEATURED);
    expect(service.featured).toHaveBeenCalledTimes(1);
  });

  it("accepts a missing input", async () => {
    const { controller } = make(FEATURED);
    expect(await call(controller.featured(), undefined)).toEqual(FEATURED);
  });

  it("passes an empty bank through", async () => {
    const { controller } = make({ session: null, items: [] });
    expect(await call(controller.featured(), {})).toEqual({
      session: null,
      items: [],
    });
  });

  it("uses the default number of subjects per task", async () => {
    const { service, controller } = make(FEATURED);
    await call(controller.featured(), {});
    const args = service.featured.mock.calls[0] as unknown[];
    // Either no argument (the default) or the default value itself.
    expect(args[0] ?? 3).toBe(3);
  });

  it("is public: no guard on the class nor on the handler", () => {
    expect(guardsOf(PublicExerciseController)).toEqual([]);
    expect(guardsOf(PublicExerciseController.prototype.featured)).toEqual([]);
  });
});

describe("ExerciseController", () => {
  it("stays behind SessionAuthGuard", () => {
    expect(guardsOf(ExerciseController)).toContain(SessionAuthGuard);
  });
});

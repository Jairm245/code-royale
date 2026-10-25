import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { questionBank } from "./questions";

/* Answers open when the question has been read, or after this at most. */
const MAX_READ_MS = 10_000;

/* How long players have to answer once answers open. */
const ANSWER_WINDOW_MS = 20_000;

export const createRoom = mutation({
  args: {
    code: v.string(),
  },

  handler: async (ctx, args) => {
    const roomId = await ctx.db.insert("rooms", {
      code: args.code,
      status: "waiting",
      currentRound: 0,
      createdAt: Date.now(),
    });

    return roomId;
  },
});

export const getRoomByCode = query({
  args: {
    code: v.string(),
  },

  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
  },
});

export const startGame = mutation({
  args: {
    roomId: v.id("rooms"),
  },

  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const duration = 20_000;

    /* random starter so every game doesn't open with the same question */
    const question =
      questionBank[Math.floor(Math.random() * questionBank.length)];

    await ctx.db.patch(args.roomId, {
      status: "playing",
      currentRound: 1,

      question: question.question,
      choices: question.choices,
      correctAnswer: question.correctAnswer,

      questionStartedAt: startedAt,
      answersOpenAt: startedAt + MAX_READ_MS,
      questionEndsAt: startedAt + MAX_READ_MS + duration,

      questionType: question.type,
codeSnippet: "code" in question ? question.code : undefined,
    });
  },
});

export const endRound = mutation({
  args: {
    roomId: v.id("rooms"),
  },

  handler: async (ctx, args) => {
    console.log("Changing room to results");

    await ctx.db.patch(args.roomId, {
      status: "results",
    });
  },
});

export const nextRound = mutation({
  args: {
    roomId: v.id("rooms"),
  },

  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found");
    }

    const nextRoundNumber = room.currentRound + 1;

    const questionIndex =
      (nextRoundNumber - 1) % questionBank.length;

    const question =
      questionBank[questionIndex];

    const startedAt = Date.now();
    const duration = 20_000;

    await ctx.db.patch(args.roomId, {
      status: "playing",
      currentRound: nextRoundNumber,

      question: question.question,
      choices: question.choices,
      correctAnswer: question.correctAnswer,

      questionStartedAt: startedAt,
      answersOpenAt: startedAt + MAX_READ_MS,
      questionEndsAt: startedAt + MAX_READ_MS + duration,

      questionType: question.type,
codeSnippet: "code" in question ? question.code : undefined,
    });
  },
});

export const setGeneratedQuestion =
  mutation({
    args: {
      roomId: v.id("rooms"),
      type: v.string(),
      question: v.string(),
      code: v.optional(v.string()),
      choices: v.array(v.string()),
      correctAnswer: v.number(),
      round: v.number(),
    },

    handler: async (ctx, args) => {
      const startedAt = Date.now();

      await ctx.db.patch(args.roomId, {
        status: "playing",

        currentRound: args.round,

        questionType: args.type,

        question: args.question,

        codeSnippet: args.code,

        choices: args.choices,

        correctAnswer:
          args.correctAnswer,

        questionStartedAt:
          startedAt,

        answersOpenAt:
          startedAt + MAX_READ_MS,

        questionEndsAt:
          startedAt +
          MAX_READ_MS +
          ANSWER_WINDOW_MS,
      });
    },
  });

/*
  Called by the host when the question has been read
  aloud. Opens answers now (if the 10 s cap hasn't
  already opened them) and starts the full answer timer.
*/
export const openAnswers =
  mutation({
    args: {
      roomId: v.id("rooms"),
      round: v.number(),
    },

    handler: async (ctx, args) => {
      const room =
        await ctx.db.get(
          args.roomId
        );

      if (
        !room ||
        room.status !==
          "playing" ||
        room.currentRound !==
          args.round
      ) {
        return { opened: false };
      }

      const now =
        Date.now();

      if (
        room.answersOpenAt !==
          undefined &&
        now >=
          room.answersOpenAt
      ) {
        return { opened: false };
      }

      await ctx.db.patch(
        args.roomId,
        {
          answersOpenAt: now,
          questionEndsAt:
            now +
            ANSWER_WINDOW_MS,
        }
      );

      return { opened: true };
    },
  });
export const setExplanation =
  mutation({
    args: {
      roomId:
        v.id("rooms"),

      summary:
        v.string(),

      steps:
        v.array(
          v.string()
        ),

      scenes:
        v.array(
          v.object({
            type:
              v.string(),

            title:
              v.string(),

            text:
              v.string(),

            narration:
              v.optional(
                v.string()
              ),

            code:
              v.optional(
                v.string()
              ),

            highlightLine:
              v.optional(
                v.number()
              ),

            highlightText:
              v.optional(
                v.string()
              ),

            takeaway:
              v.optional(
                v.string()
              ),

            visual:
              v.optional(
                v.object({
                  kind:
                    v.string(),

                  values:
                    v.optional(
                      v.array(
                        v.string()
                      )
                    ),

                  activeIndices:
                    v.optional(
                      v.array(
                        v.number()
                      )
                    ),

                  pointers:
                    v.optional(
                      v.array(
                        v.object({
                          label:
                            v.string(),

                          index:
                            v.number(),
                        })
                      )
                    ),

                  entries:
                    v.optional(
                      v.array(
                        v.object({
                          key:
                            v.string(),

                          value:
                            v.string(),

                          active:
                            v.boolean(),
                        })
                      )
                    ),

                  stack:
                    v.optional(
                      v.array(
                        v.string()
                      )
                    ),

                  operation:
                    v.optional(
                      v.string()
                    ),

                  reasoningSteps:
                    v.optional(
                      v.array(
                        v.string()
                      )
                    ),
                })
              ),
          })
        ),
    },

    handler: async (
      ctx,
      args
    ) => {
      await ctx.db.patch(
        args.roomId,
        {
          status:
            "explanation",

          explanationSummary:
            args.summary,

          explanationSteps:
            args.steps,

          explanationScenes:
            args.scenes,
        }
      );
    },
  });

export const awardComeback = mutation({
  args: {
    roomId: v.id("rooms"),
  },

  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) =>
        q.eq("roomId", args.roomId)
      )
      .collect();

    if (players.length < 2) {
      return;
    }

    const sorted = [...players].sort(
      (a, b) => a.score - b.score
    );

    const lastPlace = sorted[0];

    if ((lastPlace.fiftyFifty ?? 0) < 1) {
      await ctx.db.patch(
        lastPlace._id,
        {
          fiftyFifty: 1,
        }
      );
    }
  },
});


import {
  mutation,
} from "./_generated/server";

import {
  v,
} from "convex/values";

const MAX_ROUNDS = 10;

export const finishGame =
  mutation({
    args: {
      roomId:
        v.id("rooms"),
    },

    handler: async (
      ctx,
      args
    ) => {
      const room =
        await ctx.db.get(
          args.roomId
        );

      if (!room) {
        return {
          success: false,
        };
      }

      if (
        room.currentRound <
        MAX_ROUNDS
      ) {
        return {
          success: false,
        };
      }

      await ctx.db.patch(
        args.roomId,
        {
          status:
            "finished",

          questionEndsAt:
            undefined,
        }
      );

      return {
        success: true,
      };
    },
  });

export const resetGame =
  mutation({
    args: {
      roomId:
        v.id("rooms"),
    },

    handler: async (
      ctx,
      args
    ) => {
      const room =
        await ctx.db.get(
          args.roomId
        );

      if (!room) {
        throw new Error(
          "Room not found"
        );
      }

      const players =
        await ctx.db
          .query("players")
          .collect();

      for (
        const player of
        players
      ) {
        if (
          player.roomId !==
          args.roomId
        ) {
          continue;
        }

        await ctx.db.patch(
          player._id,
          {
            score: 0,

            fiftyFifty: 0,

            lagSpike: 1,

            firewall: 1,

            timePenalty: 0,

            firewallActive:
              false,

            fiftyFiftyActive:
              false,

            firewallBlockedThisRound:
              false,

            effectsRound: 0,

            lastLagRewardRound:
              0,
          }
        );
      }

      const answers =
        await ctx.db
          .query("answers")
          .collect();

      for (
        const answer of
        answers
      ) {
        if (
          answer.roomId ===
          args.roomId
        ) {
          await ctx.db.delete(
            answer._id
          );
        }
      }

      const events =
        await ctx.db
          .query(
            "powerupEvents"
          )
          .collect();

      for (
        const event of
        events
      ) {
        if (
          event.roomId ===
          args.roomId
        ) {
          await ctx.db.delete(
            event._id
          );
        }
      }

      const queuedPowerups =
        await ctx.db
          .query(
            "powerupQueue"
          )
          .collect();

      for (
        const queued of
        queuedPowerups
      ) {
        if (
          queued.roomId ===
          args.roomId
        ) {
          await ctx.db.delete(
            queued._id
          );
        }
      }

      await ctx.db.patch(
        args.roomId,
        {
          status: "lobby",

          currentRound: 0,

          question:
            undefined,

          questionType:
            undefined,

          codeSnippet:
            undefined,

          choices:
            undefined,

          correctAnswer:
            undefined,

          questionStartedAt:
            undefined,

          questionEndsAt:
            undefined,

          explanationSummary:
            undefined,

          explanationSteps:
            undefined,

          explanationScenes:
            undefined,
        }
      );

      return {
        success: true,
      };
    },
  });
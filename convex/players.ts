import {
  mutation,
  query,
} from "./_generated/server";

import {
  v,
} from "convex/values";

export const MAX_PLAYERS = 8;

export const joinRoom =
  mutation({
    args: {
      roomCode:
        v.string(),

      name:
        v.string(),
    },

    handler: async (
      ctx,
      args
    ) => {
      const room =
        await ctx.db
          .query("rooms")
          .withIndex(
            "by_code",
            (q) =>
              q.eq(
                "code",
                args.roomCode
              )
          )
          .unique();

      if (!room) {
        throw new Error(
          "Room not found"
        );
      }

      const playersInRoom =
        await ctx.db
          .query("players")
          .withIndex(
            "by_room",
            (q) =>
              q.eq(
                "roomId",
                room._id
              )
          )
          .collect();

      if (
        playersInRoom.length >=
        MAX_PLAYERS
      ) {
        throw new Error(
          "This game is full (8 players max)"
        );
      }

      const cleanName =
        args.name.trim();

      if (
        cleanName.length ===
        0
      ) {
        throw new Error(
          "Name is required"
        );
      }

      const playerId =
        await ctx.db.insert(
          "players",
          {
            roomId:
              room._id,

            name:
              cleanName,

            score: 0,

            connected:
              true,

            createdAt:
              Date.now(),

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

      return {
        playerId,
        roomId:
          room._id,
      };
    },
  });

export const getPlayersByRoom =
  query({
    args: {
      roomId:
        v.id("rooms"),
    },

    handler: async (
      ctx,
      args
    ) => {
      return await ctx.db
        .query("players")
        .withIndex(
          "by_room",
          (q) =>
            q.eq(
              "roomId",
              args.roomId
            )
        )
        .collect();
    },
  });

/*
  Kept for compatibility with older host code.
  New round flow should prefer:
  powerups.applyQueuedForRound.
*/
export const resetRoundEffects =
  mutation({
    args: {
      roomId:
        v.id("rooms"),
    },

    handler: async (
      ctx,
      args
    ) => {
      const players =
        await ctx.db
          .query("players")
          .withIndex(
            "by_room",
            (q) =>
              q.eq(
                "roomId",
                args.roomId
              )
          )
          .collect();

      for (
        const player of
        players
      ) {
        await ctx.db.patch(
          player._id,
          {
            timePenalty: 0,

            firewallActive:
              false,

            fiftyFiftyActive:
              false,

            firewallBlockedThisRound:
              false,
          }
        );
      }
    },
  });
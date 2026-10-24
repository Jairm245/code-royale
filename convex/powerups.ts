import { mutation } from "./_generated/server";
import { v } from "convex/values";

/* ========================================
   FIREWALL
======================================== */

export const activateFirewall = mutation({
  args: {
    playerId: v.id("players"),
  },

  handler: async (ctx, args) => {
    const player =
      await ctx.db.get(
        args.playerId
      );

    if (!player) {
      throw new Error(
        "Player not found"
      );
    }

    const room =
      await ctx.db.get(
        player.roomId
      );

    if (!room) {
      throw new Error(
        "Room not found"
      );
    }

    const available =
      player.firewall ?? 0;

    if (available <= 0) {
      throw new Error(
        "No Firewall available"
      );
    }

    await ctx.db.patch(
      args.playerId,
      {
        firewall:
          available - 1,

        firewallActive:
          true,
      }
    );

    await ctx.db.insert(
      "powerupEvents",
      {
        roomId:
          player.roomId,

        playerId:
          player._id,

        playerName:
          player.name,

        type:
          "firewall",

        round:
          room.currentRound,

        createdAt:
          Date.now(),
      }
    );

    return {
      success: true,
    };
  },
});

/* ========================================
   LAG SPIKE
======================================== */

export const useLagSpike = mutation({
  args: {
    attackerId:
      v.id("players"),

    targetId:
      v.id("players"),
  },

  handler: async (ctx, args) => {
    if (
      args.attackerId ===
      args.targetId
    ) {
      throw new Error(
        "Cannot target yourself"
      );
    }

    const attacker =
      await ctx.db.get(
        args.attackerId
      );

    const target =
      await ctx.db.get(
        args.targetId
      );

    if (
      !attacker ||
      !target
    ) {
      throw new Error(
        "Player not found"
      );
    }

    if (
      attacker.roomId !==
      target.roomId
    ) {
      throw new Error(
        "Players are not in the same room"
      );
    }

    const room =
      await ctx.db.get(
        attacker.roomId
      );

    if (!room) {
      throw new Error(
        "Room not found"
      );
    }

    const available =
      attacker.lagSpike ?? 0;

    if (available <= 0) {
      throw new Error(
        "No Lag Spike available"
      );
    }

    /*
      Consume the Lag Spike first.
    */

    await ctx.db.patch(
      attacker._id,
      {
        lagSpike:
          available - 1,
      }
    );

    /*
      FIREWALL BLOCK
    */

    if (
      target.firewallActive
    ) {
      await ctx.db.patch(
        target._id,
        {
          firewallActive:
            false,
        }
      );

      await ctx.db.insert(
        "powerupEvents",
        {
          roomId:
            target.roomId,

          playerId:
            target._id,

          playerName:
            target.name,

          type:
            "firewall",

          round:
            room.currentRound,

          createdAt:
            Date.now(),
        }
      );

      return {
        blocked: true,
      };
    }

    /*
      APPLY 5 SECOND PENALTY
    */

    await ctx.db.patch(
      target._id,
      {
        timePenalty:
          (
            target.timePenalty ??
            0
          ) + 5,
      }
    );

    await ctx.db.insert(
      "powerupEvents",
      {
        roomId:
          attacker.roomId,

        playerId:
          attacker._id,

        playerName:
          attacker.name,

        type:
          "lag",

        round:
          room.currentRound,

        createdAt:
          Date.now(),
      }
    );

    return {
      blocked: false,
    };
  },
});

/* ========================================
   50 / 50
======================================== */

export const useFiftyFifty = mutation({
  args: {
    playerId:
      v.id("players"),
  },

  handler: async (ctx, args) => {
    const player =
      await ctx.db.get(
        args.playerId
      );

    if (!player) {
      throw new Error(
        "Player not found"
      );
    }

    const room =
      await ctx.db.get(
        player.roomId
      );

    if (!room) {
      throw new Error(
        "Room not found"
      );
    }

    const available =
      player.fiftyFifty ?? 0;

    if (available <= 0) {
      throw new Error(
        "No 50/50 available"
      );
    }

    await ctx.db.patch(
      player._id,
      {
        fiftyFifty:
          available - 1,
      }
    );

    await ctx.db.insert(
      "powerupEvents",
      {
        roomId:
          player.roomId,

        playerId:
          player._id,

        playerName:
          player.name,

        type:
          "fifty",

        round:
          room.currentRound,

        createdAt:
          Date.now(),
      }
    );

    return {
      success: true,
    };
  },
});
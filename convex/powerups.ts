import {
  mutation,
} from "./_generated/server";

import {
  v,
} from "convex/values";

const MAX_ROUNDS = 10;
const LAG_SECONDS = 5;

function sameId(
  left: unknown,
  right: unknown
) {
  return String(left) ===
    String(right);
}


const ONE_PER_ROUND_MESSAGE =
  "You already used a power-up this round";

function assertPowerupAvailableThisRound(
  player: any,
  room: any
) {
  if (
    player.powerupRound ===
    room.currentRound
  ) {
    throw new Error(
      ONE_PER_ROUND_MESSAGE
    );
  }
}

async function getRoomForPlayer(
  ctx: any,
  player: any
) {
  const room =
    await ctx.db.get(
      player.roomId
    );

  if (!room) {
    throw new Error(
      "Room not found"
    );
  }

  return room;
}

async function makeEvent(
  ctx: any,
  room: any,
  player: any,
  type:
    | "lag"
    | "firewall"
    | "fifty"
) {
  await ctx.db.insert(
    "powerupEvents",
    {
      roomId: room._id,
      playerId:
        player._id,
      playerName:
        player.name,
      type,
      round:
        room.currentRound,
      createdAt:
        Date.now(),
    }
  );
}

async function alreadyQueued(
  ctx: any,
  roomId: any,
  effectiveRound: number,
  sourcePlayerId: any,
  type:
    | "lag"
    | "firewall"
    | "fifty"
) {
  const queued =
    await ctx.db
      .query("powerupQueue")
      .withIndex(
        "by_room_round",
        (q: any) =>
          q
            .eq(
              "roomId",
              roomId
            )
            .eq(
              "effectiveRound",
              effectiveRound
            )
      )
      .collect();

  return queued.some(
    (item: any) =>
      sameId(
        item.sourcePlayerId,
        sourcePlayerId
      ) &&
      item.type === type
  );
}

/*
  Use 50 / 50 IMMEDIATELY in the CURRENT round.

  This is the comeback exception:
  Lag Spike + Firewall queue for next round,
  but 50 / 50 takes effect as soon as the
  player spends it.
*/
export const useFiftyFifty =
  mutation({
    args: {
      playerId:
        v.id("players"),
    },

    handler: async (
      ctx,
      args
    ) => {
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
        await getRoomForPlayer(
          ctx,
          player
        );

      if (
        room.status !==
        "playing"
      ) {
        throw new Error(
          "50/50 can only be used during an active round"
        );
      }

      assertPowerupAvailableThisRound(
        player,
        room
      );

      const available =
        player.fiftyFifty ??
        0;

      if (available <= 0) {
        throw new Error(
          "No 50/50 available"
        );
      }

      await ctx.db.patch(
        player._id,
        {
          fiftyFifty:
            Math.max(
              0,
              available - 1
            ),
          powerupRound:
            room.currentRound,
        }
      );

      await makeEvent(
        ctx,
        room,
        player,
        "fifty"
      );

      return {
        appliedRound:
          room.currentRound,
      };
    },
  });

/*
  Queue Firewall for NEXT round.
*/
export const activateFirewall =
  mutation({
    args: {
      playerId:
        v.id("players"),
    },

    handler: async (
      ctx,
      args
    ) => {
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
        await getRoomForPlayer(
          ctx,
          player
        );

      if (
        room.currentRound >=
        MAX_ROUNDS
      ) {
        throw new Error(
          "No next round available"
        );
      }

      assertPowerupAvailableThisRound(
        player,
        room
      );

      const available =
        player.firewall ??
        0;

      if (available <= 0) {
        throw new Error(
          "No Firewall available"
        );
      }

      const effectiveRound =
        room.currentRound + 1;

      if (
        await alreadyQueued(
          ctx,
          room._id,
          effectiveRound,
          player._id,
          "firewall"
        )
      ) {
        throw new Error(
          "Firewall already queued for next round"
        );
      }

      await ctx.db.patch(
        player._id,
        {
          firewall:
            Math.max(
              0,
              available - 1
            ),
          powerupRound:
            room.currentRound,
        }
      );

      await ctx.db.insert(
        "powerupQueue",
        {
          roomId:
            room._id,
          sourcePlayerId:
            player._id,
          targetPlayerId:
            player._id,
          type:
            "firewall",
          effectiveRound,
          createdAt:
            Date.now(),
        }
      );

      await makeEvent(
        ctx,
        room,
        player,
        "firewall"
      );

      return {
        queuedForRound:
          effectiveRound,
      };
    },
  });

/*
  Queue Lag Spike for NEXT round.
  Firewall is intentionally NOT checked here.
  It is resolved when the next round starts,
  so the target has this round to respond.
*/
export const useLagSpike =
  mutation({
    args: {
      attackerId:
        v.id("players"),

      targetId:
        v.id("players"),
    },

    handler: async (
      ctx,
      args
    ) => {
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
        !sameId(
          attacker.roomId,
          target.roomId
        )
      ) {
        throw new Error(
          "Players are not in the same room"
        );
      }

      if (
        sameId(
          attacker._id,
          target._id
        )
      ) {
        throw new Error(
          "Cannot Lag Spike yourself"
        );
      }

      const room =
        await getRoomForPlayer(
          ctx,
          attacker
        );

      if (
        room.currentRound >=
        MAX_ROUNDS
      ) {
        throw new Error(
          "No next round available"
        );
      }

      assertPowerupAvailableThisRound(
        attacker,
        room
      );

      const available =
        attacker.lagSpike ??
        0;

      if (available <= 0) {
        throw new Error(
          "No Lag Spike available"
        );
      }

      const effectiveRound =
        room.currentRound + 1;

      await ctx.db.patch(
        attacker._id,
        {
          lagSpike:
            Math.max(
              0,
              available - 1
            ),
          powerupRound:
            room.currentRound,
        }
      );

      await ctx.db.insert(
        "powerupQueue",
        {
          roomId:
            room._id,
          sourcePlayerId:
            attacker._id,
          targetPlayerId:
            target._id,
          type:
            "lag",
          effectiveRound,
          createdAt:
            Date.now(),
        }
      );

      await makeEvent(
        ctx,
        room,
        attacker,
        "lag"
      );

      return {
        queuedForRound:
          effectiveRound,
        targetName:
          target.name,
      };
    },
  });

/*
  Apply every queued effect for one round.

  effectsRound makes this mutation idempotent:
  if it is called twice for the same round,
  it does not wipe out already-applied effects.
*/
export const applyQueuedForRound =
  mutation({
    args: {
      roomId:
        v.id("rooms"),

      round:
        v.number(),
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

      if (
        players.length > 0 &&
        players.every(
          (player) =>
            (player.effectsRound ??
              0) ===
            args.round
        )
      ) {
        return {
          applied: false,
          alreadyApplied:
            true,
        };
      }

      const queued =
        await ctx.db
          .query(
            "powerupQueue"
          )
          .withIndex(
            "by_room_round",
            (q) =>
              q
                .eq(
                  "roomId",
                  args.roomId
                )
                .eq(
                  "effectiveRound",
                  args.round
                )
          )
          .collect();

      for (
        const player of
        players
      ) {
        const hasFirewall =
          queued.some(
            (item) =>
              item.type ===
                "firewall" &&
              sameId(
                item.sourcePlayerId,
                player._id
              )
          );

        const incomingLag =
          queued.filter(
            (item) =>
              item.type ===
                "lag" &&
              item.targetPlayerId !==
                undefined &&
              sameId(
                item.targetPlayerId,
                player._id
              )
          ).length;

        /*
          One Firewall blocks one
          incoming Lag Spike.
        */
        const blocked =
          hasFirewall &&
          incomingLag > 0;

        const effectiveLagCount =
          Math.max(
            0,
            incomingLag -
              (blocked ? 1 : 0)
          );

        await ctx.db.patch(
          player._id,
          {
            timePenalty:
              effectiveLagCount *
              LAG_SECONDS,

            firewallActive:
              hasFirewall &&
              !blocked,

            firewallBlockedThisRound:
              blocked,

            fiftyFiftyActive:
              false,

            effectsRound:
              args.round,
          }
        );
      }

      for (
        const item of
        queued
      ) {
        await ctx.db.delete(
          item._id
        );
      }

      return {
        applied: true,
        alreadyApplied:
          false,
      };
    },
  });

/*
  Award +1 Lag Spike when a player reaches:
  - every 3-answer correct streak milestone, OR
  - every 5-total-correct milestone.

  If both happen on the same round,
  only one Lag Spike is awarded.
*/
export const awardLagSpikeMilestones =
  mutation({
    args: {
      roomId:
        v.id("rooms"),

      round:
        v.number(),
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

      const allAnswers =
        await ctx.db
          .query("answers")
          .collect();

      const roomAnswers =
        allAnswers.filter(
          (answer) =>
            sameId(
              answer.roomId,
              args.roomId
            ) &&
            answer.round <=
              args.round
        );

      const awarded:
        Array<{
          playerId: string;
          playerName: string;
          reason: string;
        }> = [];

      for (
        const player of
        players
      ) {
        const playerAnswers =
          roomAnswers.filter(
            (answer) =>
              sameId(
                answer.playerId,
                player._id
              )
          );

        const currentAnswer =
          playerAnswers.find(
            (answer) =>
              answer.round ===
              args.round
          );

        if (
          !currentAnswer ||
          currentAnswer.correct !==
            true
        ) {
          continue;
        }

        const totalCorrect =
          playerAnswers.filter(
            (answer) =>
              answer.correct ===
              true
          ).length;

        const correctByRound =
          new Map<
            number,
            boolean
          >();

        for (
          const answer of
          playerAnswers
        ) {
          correctByRound.set(
            answer.round,
            answer.correct ===
              true
          );
        }

        let streak = 0;

        for (
          let round =
            args.round;
          round >= 1;
          round -= 1
        ) {
          if (
            correctByRound.get(
              round
            ) !== true
          ) {
            break;
          }

          streak += 1;
        }

        const streakMilestone =
          streak > 0 &&
          streak % 3 === 0;

        const totalMilestone =
          totalCorrect > 0 &&
          totalCorrect % 5 ===
            0;

        if (
          !streakMilestone &&
          !totalMilestone
        ) {
          continue;
        }

        if (
          (player.lastLagRewardRound ??
            0) ===
          args.round
        ) {
          continue;
        }

        await ctx.db.patch(
          player._id,
          {
            lagSpike:
              (player.lagSpike ??
                0) + 1,

            lastLagRewardRound:
              args.round,
          }
        );

        awarded.push({
          playerId:
            String(
              player._id
            ),
          playerName:
            player.name,
          reason:
            streakMilestone &&
            totalMilestone
              ? "streak-and-total"
              : streakMilestone
                ? "streak"
                : "total",
        });
      }

      return {
        awarded,
      };
    },
  });
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const submitAnswer = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    answerIndex: v.number(),
  },

  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found");
    }

    if (
      room.correctAnswer === undefined ||
      room.questionEndsAt === undefined
    ) {
      throw new Error("No active question");
    }

    const existingAnswer = await ctx.db
      .query("answers")
      .withIndex("by_player_round", (q) =>
        q
          .eq("playerId", args.playerId)
          .eq("round", room.currentRound)
      )
      .unique();

    if (existingAnswer) {
      throw new Error("Already answered");
    }

    const now = Date.now();

    /*
      Answers stay locked until the question has been
      read (small grace for clock/network jitter).
    */
    if (
      room.answersOpenAt !== undefined &&
      now < room.answersOpenAt - 400
    ) {
      throw new Error("Answers open after the question is read");
    }

    const correct =
      args.answerIndex === room.correctAnswer;

    let points = 0;

    if (correct && now <= room.questionEndsAt) {
      const remaining =
        room.questionEndsAt - now;

      /* speed bonus is measured from when answers opened */
      const totalDuration =
        room.questionEndsAt -
        (room.answersOpenAt ??
          room.questionStartedAt ??
          now);

      const percentageRemaining =
        Math.max(0, remaining / totalDuration);

      points =
        500 +
        Math.round(percentageRemaining * 500);
    }

    await ctx.db.insert("answers", {
      roomId: args.roomId,
      playerId: args.playerId,
      round: room.currentRound,
      answerIndex: args.answerIndex,
      correct,
      points,
      answeredAt: now,
    });

    if (correct && points > 0) {
      const player = await ctx.db.get(
        args.playerId
      );

      if (player) {
        await ctx.db.patch(args.playerId, {
          score: player.score + points,
        });
      }
    }

    return {
      correct,
      points,
    };
  },
});

export const getAnswersForRound = query({
  args: {
    roomId: v.id("rooms"),
    round: v.number(),
  },

  handler: async (ctx, args) => {
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_room", (q) =>
        q.eq("roomId", args.roomId)
      )
      .collect();

    return answers.filter(
      (answer) => answer.round === args.round
    );
  },
});
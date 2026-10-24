import { query } from "./_generated/server";
import { v } from "convex/values";

export const getForRound = query({
  args: {
    roomId: v.id("rooms"),
    round: v.number(),
  },

  handler: async (ctx, args) => {
    return await ctx.db
      .query("powerupEvents")
      .withIndex(
        "by_room_round",
        (q) =>
          q
            .eq(
              "roomId",
              args.roomId
            )
            .eq(
              "round",
              args.round
            )
      )
      .order("asc")
      .take(100);
  },
});
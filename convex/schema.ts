import {
  defineSchema,
  defineTable,
} from "convex/server";

import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    status: v.string(),
    currentRound: v.number(),
    createdAt: v.number(),

    questionType: v.optional(v.string()),
    question: v.optional(v.string()),
    codeSnippet: v.optional(v.string()),

    choices: v.optional(
      v.array(v.string())
    ),


    correctAnswer: v.optional(
      v.number()
    ),

    questionStartedAt: v.optional(
      v.number()
    ),

    questionEndsAt: v.optional(
      v.number()
    ),

    /*
      Answers unlock when the host finishes reading
      the question, or at this time at the latest
      (10 s after the round starts). The 20 s answer
      timer runs from here, so questionEndsAt is
      answersOpenAt + 20 s.
    */
    answersOpenAt: v.optional(
      v.number()
    ),

    explanationSummary: v.optional(
      v.string()
    ),

    explanationSteps: v.optional(
      v.array(v.string())
    ),

    explanationScenes: v.optional(
      v.array(
        v.object({
          type: v.string(),
          title: v.string(),
          text: v.string(),

          narration:
  v.optional(
    v.string()
  ),

          code: v.optional(
            v.string()
          ),

          highlightLine: v.optional(
            v.number()
          ),

          highlightText: v.optional(
            v.string()
          ),

          takeaway: v.optional(
            v.string()
          ),

          visual: v.optional(
            v.object({
              kind: v.string(),

              values: v.optional(
                v.array(
                  v.string()
                )
              ),

              activeIndices: v.optional(
                v.array(
                  v.number()
                )
              ),

              pointers: v.optional(
                v.array(
                  v.object({
                    label: v.string(),
                    index: v.number(),
                  })
                )
              ),

              entries: v.optional(
                v.array(
                  v.object({
                    key: v.string(),
                    value: v.string(),
                    active: v.boolean(),
                  })
                )
              ),

              stack: v.optional(
                v.array(
                  v.string()
                )
              ),

              operation: v.optional(
                v.string()
              ),

              reasoningSteps: v.optional(
                v.array(
                  v.string()
                )
              ),
              
            })
          ),
        })
      )
    ),
  }).index(
    "by_code",
    ["code"]
  ),

  players: defineTable({
    roomId: v.id("rooms"),
    name: v.string(),
    score: v.number(),
    connected: v.boolean(),
    createdAt: v.number(),

    fiftyFifty: v.optional(
      v.number()
    ),

    lagSpike: v.optional(
      v.number()
    ),

    firewall: v.optional(
      v.number()
    ),

    timePenalty: v.optional(
      v.number()
    ),

    firewallActive: v.optional(
      v.boolean()
    ),
    fiftyFiftyActive:
  v.optional(
    v.boolean()
  ),

    /* round in which this player last spent a power-up (one per round) */
    powerupRound: v.optional(
      v.number()
    ),

firewallBlockedThisRound:
  v.optional(
    v.boolean()
  ),

effectsRound:
  v.optional(
    v.number()
  ),

lastLagRewardRound:
  v.optional(
    v.number()
  ),
  }).index(
    "by_room",
    ["roomId"]
  ),
  powerupQueue: defineTable({
  roomId:
    v.id("rooms"),

  sourcePlayerId:
    v.id("players"),

  targetPlayerId:
    v.optional(
      v.id("players")
    ),

  type:
    v.union(
      v.literal("lag"),
      v.literal("firewall"),
      v.literal("fifty")
    ),

  effectiveRound:
    v.number(),

  createdAt:
    v.number(),
}).index(
  "by_room_round",
  [
    "roomId",
    "effectiveRound",
  ]
),

  answers: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    round: v.number(),
    answerIndex: v.number(),
    correct: v.boolean(),
    points: v.number(),
    answeredAt: v.number(),
  })
    .index(
      "by_room",
      ["roomId"]
    )
    .index(
      "by_player_round",
      [
        "playerId",
        "round",
      ]
    ),

  powerupEvents: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    playerName: v.string(),

    type: v.union(
      v.literal("lag"),
      v.literal("firewall"),
      v.literal("fifty")
    ),

    round: v.number(),
    createdAt: v.number(),
  }).index(
    "by_room_round",
    [
      "roomId",
      "round",
    ]
  ),
});

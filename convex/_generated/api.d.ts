/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiExplanation from "../aiExplanation.js";
import type * as aiQuestions from "../aiQuestions.js";
import type * as answers from "../answers.js";
import type * as gameLifecycle from "../gameLifecycle.js";
import type * as players from "../players.js";
import type * as powerupEvents from "../powerupEvents.js";
import type * as powerups from "../powerups.js";
import type * as questions from "../questions.js";
import type * as rooms from "../rooms.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiExplanation: typeof aiExplanation;
  aiQuestions: typeof aiQuestions;
  answers: typeof answers;
  gameLifecycle: typeof gameLifecycle;
  players: typeof players;
  powerupEvents: typeof powerupEvents;
  powerups: typeof powerups;
  questions: typeof questions;
  rooms: typeof rooms;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

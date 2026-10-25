import {
  action,
} from "./_generated/server";

import {
  v,
} from "convex/values";

/*
  NOTE:
  gpt-4o-mini-tts is being used here because
  it currently supports the Speech API's
  expressive "instructions" field.

  Keep all voice-model details isolated in
  this file so migrating to Realtime later
  only requires changing this backend module.
*/

const SPEECH_MODEL =
  "gpt-4o-mini-tts";

const SPEECH_VOICE =
  "cedar";

const MAX_NARRATION_CHARS =
  3500;

function buildVoiceInstructions(
  sceneType?: string
) {
  const sceneHint =
    sceneType?.trim()
      ? `This segment is a ${sceneType.trim()} segment.`
      : "";

  return [
    "You are the energetic game-show host and AI coding coach for Code Royale.",
    "Sound natural, expressive, confident, and conversational — never robotic.",
    "You are also an experienced software engineer teaching interview reasoning.",
    "Use lively game-show energy without sounding cheesy or shouting.",
    "Vary your pacing and intonation.",
    "Build a little suspense before important reveals.",
    "Emphasize key algorithmic ideas and important complexity terms.",
    "Use brief natural pauses between ideas.",
    "When explaining a mistake, sound encouraging rather than judgmental.",
    "When revealing the correct reasoning, sound confident and satisfying.",
    "Do not sound like you are reading text from a slide.",
    "Speak contractions naturally.",
    "Keep technical terms precise.",
    sceneHint,
  ]
    .filter(Boolean)
    .join(" ");
}

export const generateSpeech =
  action({
    args: {
      text:
        v.string(),

      sceneType:
        v.optional(
          v.string()
        ),
    },

    handler: async (
      ctx,
      args
    ) => {
      const apiKey =
        process.env
          .OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY is not configured in Convex."
        );
      }

      const narration =
        args.text
          .trim()
          .slice(
            0,
            MAX_NARRATION_CHARS
          );

      if (
        narration.length ===
        0
      ) {
        throw new Error(
          "Narration is empty."
        );
      }

      const response =
        await fetch(
          "https://api.openai.com/v1/audio/speech",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${apiKey}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                model:
                  SPEECH_MODEL,

                voice:
                  SPEECH_VOICE,

                input:
                  narration,

                instructions:
                  buildVoiceInstructions(
                    args.sceneType
                  ),

                response_format:
                  "wav",

                speed:
                  args.sceneType ===
                  "question"
                    ? 1.06
                    : 1.03,
              }),
          }
        );

      if (!response.ok) {
        const details =
          await response
            .text()
            .catch(
              () => ""
            );

        console.error(
          "OpenAI speech generation failed:",
          response.status,
          details
        );

        throw new Error(
          "AI voice generation failed."
        );
      }

      const audioBuffer =
        await response
          .arrayBuffer();

      if (
        audioBuffer.byteLength ===
        0
      ) {
        throw new Error(
          "AI voice returned empty audio."
        );
      }

      const storageId =
        await ctx.storage.store(
          new Blob(
            [
              audioBuffer,
            ],
            {
              type:
                "audio/wav",
            }
          )
        );

      const url =
        await ctx.storage.getUrl(
          storageId
        );

      if (!url) {
        await ctx.storage.delete(
          storageId
        );

        throw new Error(
          "Could not create audio URL."
        );
      }

      return {
        url,
        storageId,
      };
    },
  });

/*
  Cleanup after the browser finishes
  playing a generated narration clip.

  If cleanup fails, playback itself is
  unaffected.
*/
export const deleteSpeech =
  action({
    args: {
      storageId:
        v.id("_storage"),
    },

    handler: async (
      ctx,
      args
    ) => {
      try {
        await ctx.storage.delete(
          args.storageId
        );

        return {
          deleted: true,
        };
      } catch (
        error
      ) {
        console.error(
          "AI voice cleanup failed:",
          error
        );

        return {
          deleted: false,
        };
      }
    },
  });

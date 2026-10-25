import {
  httpRouter,
} from "convex/server";

import {
  httpAction,
} from "./_generated/server";

const http =
  httpRouter();

const MAX_STREAM_TEXT_CHARS =
  1200;

function buildVoiceInstructions(
  sceneType:
    string
) {
  const common = [
    "You are the AI host and coding coach for Code Royale.",
    "Sound highly expressive, natural, confident, and human-like.",
    "Use clear emotional contrast, dynamic intonation, and intentional pacing.",
    "Never sound flat, robotic, sleepy, or like you are reading a slide.",
    "Use short dramatic pauses before important reveals.",
    "Punch important technical words without shouting.",
    "Keep the energy polished and competitive, like a modern game-show host who is also a strong software engineer.",
  ];

  const specific =
    sceneType ===
    "question"
      ? [
          "This is a live coding-game question.",
          "Open with crisp game-show energy.",
          "Say the category with a quick punch, pause briefly, then read the question clearly.",
          "Build urgency and curiosity without sounding rushed.",
          "End with a slight upward energy that invites players to answer.",
        ]
      : sceneType ===
          "bug_hunt"
        ? [
            "This is a bug hunt reveal.",
            "Sound investigative and suspenseful at first.",
            "When the bug is identified, make the reveal feel satisfying and obvious in hindsight.",
          ]
        : sceneType ===
            "complexity"
          ? [
              "This is a complexity explanation.",
              "Emphasize the contrast between slower and optimized runtimes.",
              "Make the optimized result feel like a payoff.",
            ]
          : sceneType ===
              "takeaway"
            ? [
                "This is the final takeaway.",
                "Sound concise, memorable, and triumphant.",
                "Land the final sentence like an interview tip worth remembering.",
              ]
            : [
                "This is an AI Coach explanation scene.",
                "Sound curious while setting up the idea, then increasingly confident as the reasoning becomes clear.",
                "Use natural conversational emphasis and small emotional shifts.",
              ];

  return [
    ...common,
    ...specific,
  ].join(
    " "
  );
}

const streamVoice =
  httpAction(
    async (
      _ctx,
      request
    ) => {
      const apiKey =
        process.env
          .OPENAI_API_KEY;

      if (!apiKey) {
        return new Response(
          "OPENAI_API_KEY is not configured.",
          {
            status: 500,
          }
        );
      }

      const requestUrl =
        new URL(
          request.url
        );

      const text =
        (
          requestUrl
            .searchParams
            .get(
              "text"
            ) ??
          ""
        ).trim();

      const sceneType =
        (
          requestUrl
            .searchParams
            .get(
              "sceneType"
            ) ??
          "coach"
        ).trim();

      if (!text) {
        return new Response(
          "Missing text.",
          {
            status: 400,
          }
        );
      }

      if (
        text.length >
        MAX_STREAM_TEXT_CHARS
      ) {
        return new Response(
          "Text is too long.",
          {
            status: 413,
          }
        );
      }

      const openAIResponse =
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
                  "gpt-4o-mini-tts",

                /*
                  Marin is one of OpenAI's recommended
                  high-quality built-in voices.
                */
                voice:
                  "marin",

                input:
                  text,

                instructions:
                  buildVoiceInstructions(
                    sceneType
                  ),

                /*
                  MP3 is broadly supported by browser
                  <audio> elements. The latency win comes
                  from streaming the response immediately
                  instead of storing the full clip first.
                */
                response_format:
                  "mp3",

                stream_format:
                  "audio",

                speed:
                  sceneType ===
                  "question"
                    ? 1.08
                    : 1.04,
              }),

            signal:
              request.signal,
          }
        );

      if (
        !openAIResponse.ok ||
        !openAIResponse.body
      ) {
        const details =
          await openAIResponse
            .text()
            .catch(
              () => ""
            );

        console.error(
          "OpenAI streaming speech failed:",
          openAIResponse.status,
          details
        );

        return new Response(
          "AI voice generation failed.",
          {
            status:
              openAIResponse.status ||
              500,
          }
        );
      }

      return new Response(
        openAIResponse.body,
        {
          status: 200,

          headers: {
            "Content-Type":
              openAIResponse
                .headers
                .get(
                  "content-type"
                ) ??
              "audio/mpeg",

            "Cache-Control":
              "no-store",

            "Access-Control-Allow-Origin":
              "*",

            "X-Content-Type-Options":
              "nosniff",
          },
        }
      );
    }
  );

http.route({
  path:
    "/voice",

  method:
    "GET",

  handler:
    streamVoice,
});

export default http;
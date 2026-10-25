let activeAudio:
  HTMLAudioElement | null =
  null;

let playbackToken = 0;

const MAX_STREAM_TEXT_CHARS =
  1200;

export type GeneratedVoiceOptions = {
  onStart?:
    () => void;

  onEnd?:
    () => void;

  onError?:
    (
      error:
        unknown
    ) => void;
};

function getConvexSiteUrl() {
  const viteMeta =
    import.meta as
      ImportMeta & {
        env?: {
          VITE_CONVEX_URL?:
            string;

          VITE_CONVEX_SITE_URL?:
            string;
        };
      };

  const explicitSiteUrl =
    viteMeta.env
      ?.VITE_CONVEX_SITE_URL;

  if (explicitSiteUrl) {
    return explicitSiteUrl.replace(
      /\/$/,
      ""
    );
  }

  const convexUrl =
    viteMeta.env
      ?.VITE_CONVEX_URL;

  if (convexUrl) {
    const normalized =
      convexUrl.replace(
        /\/$/,
        ""
      );

    if (
      normalized.endsWith(
        ".convex.cloud"
      )
    ) {
      return normalized.replace(
        /\.convex\.cloud$/,
        ".convex.site"
      );
    }
  }

  return "https://oceanic-snail-433.convex.site";
}

export function getStreamingVoiceUrl(
  text:
    string,

  sceneType:
    string = "coach"
) {
  const narration =
    text.trim();

  if (!narration) {
    throw new Error(
      "Narration is empty."
    );
  }

  if (
    narration.length >
    MAX_STREAM_TEXT_CHARS
  ) {
    throw new Error(
      `Narration is too long for streaming voice (${narration.length} chars).`
    );
  }

  const url =
    new URL(
      "/voice",
      getConvexSiteUrl()
    );

  url.searchParams.set(
    "text",
    narration
  );

  url.searchParams.set(
    "sceneType",
    sceneType
  );

  url.searchParams.set(
    "v",
    "2"
  );

  return url.toString();
}

export async function playGeneratedVoice(
  url:
    string,

  options:
    GeneratedVoiceOptions =
      {}
) {
  stopGeneratedVoice();

  const token =
    ++playbackToken;

  const audio =
    new Audio(
      url
    );

  activeAudio =
    audio;

  audio.preload =
    "auto";

  const cleanup =
    () => {
      if (
        activeAudio ===
        audio
      ) {
        activeAudio =
          null;
      }
    };

  audio.onplaying =
    () => {
      if (
        token !==
        playbackToken
      ) {
        return;
      }

      options.onStart?.();
    };

  audio.onended =
    () => {
      if (
        token !==
        playbackToken
      ) {
        cleanup();
        return;
      }

      cleanup();

      options.onEnd?.();
    };

  audio.onerror =
    () => {
      if (
        token !==
        playbackToken
      ) {
        cleanup();
        return;
      }

      cleanup();

      options.onError?.(
        new Error(
          "Generated voice playback failed."
        )
      );
    };

  try {
    await audio.play();
  } catch (
    error
  ) {
    cleanup();

    if (
      token ===
      playbackToken
    ) {
      options.onError?.(
        error
      );
    }

    throw error;
  }
}

export async function playStreamingVoice(
  text:
    string,

  sceneType:
    string,

  options:
    GeneratedVoiceOptions =
      {}
) {
  const url =
    getStreamingVoiceUrl(
      text,
      sceneType
    );

  return playGeneratedVoice(
    url,
    options
  );
}

export function stopGeneratedVoice() {
  playbackToken += 1;

  if (
    !activeAudio
  ) {
    return;
  }

  activeAudio.pause();

  try {
    activeAudio.currentTime =
      0;
  } catch {
    // Some streaming media cannot seek before metadata loads.
  }

  activeAudio.onplaying =
    null;

  activeAudio.onended =
    null;

  activeAudio.onerror =
    null;

  activeAudio =
    null;
}
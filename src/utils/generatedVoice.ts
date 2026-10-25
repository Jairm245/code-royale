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

  /*
    0 -> 1 playback progress.

    Streaming MP3 duration is not always available
    immediately, so the player begins with a text-
    based duration estimate and automatically uses
    the real audio duration if the browser exposes it.
  */
  onProgress?:
    (
      progress:
        number,

      currentTime:
        number,

      duration:
        number
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

  /*
    Prefer an explicit HTTP-actions URL when one
    exists.
  */
  const explicitSiteUrl =
    viteMeta.env
      ?.VITE_CONVEX_SITE_URL;

  if (explicitSiteUrl) {
    return explicitSiteUrl.replace(
      /\/$/,
      ""
    );
  }

  /*
    Standard Convex Vite projects normally expose
    VITE_CONVEX_URL. Convert the normal
    *.convex.cloud API URL to the *.convex.site
    HTTP-actions URL.
  */
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

  /*
    Fallback for the current Code Royale Convex
    deployment.
  */
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
      {},

  estimatedDurationSeconds:
    number = 12
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

  let progressAnimation:
    number | null =
    null;

  function stopProgressLoop() {
    if (
      progressAnimation !==
      null
    ) {
      cancelAnimationFrame(
        progressAnimation
      );

      progressAnimation =
        null;
    }
  }

  function getDuration() {
    if (
      Number.isFinite(
        audio.duration
      ) &&
      audio.duration >
        0
    ) {
      return audio.duration;
    }

    return Math.max(
      1,
      estimatedDurationSeconds
    );
  }

  function reportProgress() {
    if (
      token !==
      playbackToken
    ) {
      return;
    }

    const duration =
      getDuration();

    /*
      Keep streaming progress below 1 until
      onended fires. That prevents the visual
      timeline from completing before narration.
    */
    const progress =
      Math.min(
        0.985,
        Math.max(
          0,
          audio.currentTime /
            duration
        )
      );

    options.onProgress?.(
      progress,
      audio.currentTime,
      duration
    );

    progressAnimation =
      requestAnimationFrame(
        reportProgress
      );
  }

  const cleanup =
    () => {
      stopProgressLoop();
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

      stopProgressLoop();

      options.onProgress?.(
        0,
        audio.currentTime,
        getDuration()
      );

      progressAnimation =
        requestAnimationFrame(
          reportProgress
        );
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

      stopProgressLoop();

      options.onProgress?.(
        1,
        audio.currentTime,
        getDuration()
      );

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

function estimateSpeechDuration(
  text:
    string,

  sceneType:
    string
) {
  const words =
    text
      .trim()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      )
      .length;

  const punctuationPauses =
    (
      text.match(
        /[.!?;:]/g
      ) ??
      []
    ).length;

  /*
    Slightly conservative estimate so visuals
    never race ahead of the narration.
  */
  const wordsPerSecond =
    sceneType ===
      "question"
      ? 2.65
      : 2.35;

  return Math.max(
    2.5,
    words /
      wordsPerSecond +
      punctuationPauses *
        0.16
  );
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
    options,
    estimateSpeechDuration(
      text,
      sceneType
    )
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

import { toSpeakable } from "./speakable";
import { setVoiceActive } from "./sfx";

/* ========================================
   CODE ROYALE VOICE
======================================== */



let speechSession = 0;

/* ========================================
   SPLIT LONG SPEECH INTO CHUNKS
======================================== */

function splitSpeechIntoChunks(
  text: string,
  maxLength = 180
) {
  const cleanText =
    text
      .replace(/\s+/g, " ")
      .trim();

  if (!cleanText) {
    return [];
  }

  const sentences =
    cleanText.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    ) ?? [cleanText];

  const chunks: string[] = [];

  let current = "";

  for (const sentence of sentences) {
    const trimmed =
      sentence.trim();

    if (!trimmed) {
      continue;
    }

    /*
      Sentence fits in current chunk.
    */
    if (
      current.length +
        trimmed.length +
        1 <=
      maxLength
    ) {
      current =
        current.length > 0
          ? `${current} ${trimmed}`
          : trimmed;

      continue;
    }

    if (current) {
      chunks.push(current);

      current = "";
    }

    /*
      If one sentence itself is too long,
      split it by words.
    */
    if (
      trimmed.length >
      maxLength
    ) {
      const words =
        trimmed.split(/\s+/);

      let wordChunk = "";

      for (const word of words) {
        if (
          wordChunk.length +
            word.length +
            1 <=
          maxLength
        ) {
          wordChunk =
            wordChunk
              ? `${wordChunk} ${word}`
              : word;
        } else {
          if (wordChunk) {
            chunks.push(
              wordChunk
            );
          }

          wordChunk =
            word;
        }
      }

      if (wordChunk) {
        current =
          wordChunk;
      }
    } else {
      current =
        trimmed;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/* ========================================
   SELECT VOICE
======================================== */

function getPreferredVoice() {
  if (
    !(
      "speechSynthesis" in
      window
    )
  ) {
    return undefined;
  }

  const voices =
    window.speechSynthesis.getVoices();

  const samantha =
    voices.find(
      (voice) =>
        voice.localService &&
        voice.name
          .toLowerCase()
          .includes("samantha")
    );

  if (samantha) {
    return samantha;
  }

  const alex =
    voices.find(
      (voice) =>
        voice.localService &&
        voice.name
          .toLowerCase()
          .includes("alex")
    );

  if (alex) {
    return alex;
  }

  const localEnglish =
    voices.find(
      (voice) =>
        voice.localService &&
        voice.lang
          .toLowerCase()
          .startsWith("en")
    );

  if (localEnglish) {
    return localEnglish;
  }

  return voices.find(
    (voice) =>
      voice.lang
        .toLowerCase()
        .startsWith("en")
  );
}

/* ========================================
   STOP
======================================== */

export function stopVoice() {
  speechSession += 1;
  setVoiceActive(false);

  

  if (
    "speechSynthesis" in
    window
  ) {
    window.speechSynthesis.cancel();
  }
}

/* ========================================
   SPEAK
======================================== */

export function speak(
  text: string,

  options?: {
    rate?: number;
    pitch?: number;
    volume?: number;

    onStart?: () => void;

    onEnd?: () => void;

    onError?: (
      error?: string
    ) => void;
  }
) {
  /* duck the music while the browser voice speaks */
  const callerOptions = options;
  setVoiceActive(true);
  options = {
    ...callerOptions,
    onEnd: () => {
      setVoiceActive(false);
      callerOptions?.onEnd?.();
    },
    onError: (error?: string) => {
      setVoiceActive(false);
      callerOptions?.onError?.(error);
    },
  };

  if (
    !(
      "speechSynthesis" in
      window
    )
  ) {
    options?.onEnd?.();

    return;
  }

  /* say "equals", not "equals equals" */
  const chunks =
    splitSpeechIntoChunks(
      toSpeakable(
        text
      )
    );

  if (
    chunks.length ===
    0
  ) {
    options?.onEnd?.();

    return;
  }

  /*
    Kill previous narration.
  */
  speechSession += 1;

  const mySession =
    speechSession;

  

  window.speechSynthesis.cancel();

  const voice =
    getPreferredVoice();

  let index = 0;

  let started =
    false;

  function speakNextChunk() {
    /*
      Another narration replaced us.
    */
    if (
      mySession !==
      speechSession
    ) {
      return;
    }

    /*
      All chunks complete.
    */
    if (
      index >=
      chunks.length
    ) {
      

      options?.onEnd?.();

      return;
    }

    const chunk =
      chunks[index];

    const utterance =
      new SpeechSynthesisUtterance(
        chunk
      );

    // activeUtterance =
    //   utterance;

    utterance.rate =
      options?.rate ??
      0.98;

    utterance.pitch =
      options?.pitch ??
      1;

    utterance.volume =
      options?.volume ??
      1;

    if (voice) {
      utterance.voice =
        voice;

      utterance.lang =
        voice.lang;
    } else {
      utterance.lang =
        "en-US";
    }

    utterance.onstart =
      () => {
        if (
          mySession !==
          speechSession
        ) {
          return;
        }

        if (!started) {
          started =
            true;

          options?.onStart?.();
        }
      };

    utterance.onend =
      () => {
        if (
          mySession !==
          speechSession
        ) {
          return;
        }

        index += 1;

        /*
          Tiny gap prevents browsers from
          dropping consecutive utterances.
        */
        setTimeout(
          () => {
            speakNextChunk();
          },
          80
        );
      };

    utterance.onerror =
      (
        event:
          SpeechSynthesisErrorEvent
      ) => {
        if (
          mySession !==
          speechSession
        ) {
          return;
        }

        if (
          event.error ===
            "canceled" ||
          event.error ===
            "interrupted"
        ) {
          return;
        }

        // activeUtterance =
        //   null;

        console.error(
          "Speech synthesis error:",
          event.error
        );

        options?.onError?.(
          event.error
        );
      };

    try {
      window.speechSynthesis.speak(
        utterance
      );
    } catch (error) {
      console.error(
        "Could not start speech:",
        error
      );

      options?.onError?.(
        "start-failed"
      );
    }
  }

  speakNextChunk();
}
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The slice of the Web Speech API this uses; Safari only has the prefixed one. */
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = (): (() => void) => () => undefined;
const LANGUAGES = [
  { code: "es-419", label: "ES" },
  { code: "en-US", label: "EN" },
] as const;
const LANG_KEY = "travel-assistant-voice-lang";

function storedLanguage(): string {
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    // Private mode: fall through to the browser's languages.
  }
  return navigator.languages?.some((l) => l.startsWith("es")) ? "es-419" : "en-US";
}

const BARS = 5;

/**
 * Dictation for the assistant: tap, speak, tap again.
 *
 * What is said lands in the message box as it is recognised, to read and fix
 * before sending — a misheard date is easier to see there than in a proposal.
 * The bars follow the microphone's level, so it is obvious it is listening.
 * Absent in browsers without speech recognition (Firefox).
 */
export function VoiceButton({
  onStart,
  onTranscript,
  disabled,
}: {
  /** Listening begins: the moment to remember what was already typed. */
  onStart?: () => void;
  /** The words so far, replacing what this session of listening said before. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const supported = useSyncExternalStore(noop, () => recognitionClass() !== null, () => false);
  const [lang, setLang] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const recognition = useRef<Recognition | null>(null);
  const stopMeter = useRef<(() => void) | null>(null);

  const language = lang ?? (supported ? storedLanguage() : "es-419");

  useEffect(
    () => () => {
      recognition.current?.stop();
      stopMeter.current?.();
    },
    []
  );

  async function startMeter(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 64;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let frame = 0;
      const tick = (): void => {
        analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / BARS);
        setLevels(Array.from({ length: BARS }, (_, i) => data[i * step + 1] / 255));
        frame = requestAnimationFrame(tick);
      };
      tick();
      // Once only: unmounting stops it, and so does the recognition ending
      // right after, and a second close() rejects on a closed context.
      let stopped = false;
      stopMeter.current = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(frame);
        stream.getTracks().forEach((t) => t.stop());
        void context.close();
        setLevels(Array(BARS).fill(0));
      };
    } catch {
      // No level meter without a second microphone grant; dictation still works.
    }
  }

  function start(): void {
    const Class = recognitionClass();
    if (!Class) return;
    const rec = new Class();
    rec.lang = language;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      const words = Array.from(event.results, (r) => r[0].transcript).join(" ");
      onTranscript(words.replace(/\s+/g, " ").trim());
    };
    rec.onend = () => {
      setListening(false);
      stopMeter.current?.();
      stopMeter.current = null;
    };
    rec.onerror = () => rec.stop();
    recognition.current = rec;
    onStart?.();
    rec.start();
    setListening(true);
    void startMeter();
  }

  function stop(): void {
    recognition.current?.stop();
  }

  function toggleLanguage(): void {
    const next = language === "es-419" ? "en-US" : "es-419";
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      // Remembered for this page only.
    }
  }

  if (!supported) return null;

  if (listening) {
    return (
      <Button
        type="button"
        variant="destructive"
        onClick={stop}
        aria-label="Stop dictation"
        className="h-10 gap-2 rounded-full px-3"
      >
        <span aria-hidden className="flex h-4 items-center gap-0.5">
          {levels.map((level, i) => (
            <span
              key={i}
              className="w-0.5 rounded-full bg-current transition-[height] duration-75"
              // A computed level, not a spacing choice.
              style={{ height: `${Math.max(20, Math.round(level * 100))}%` }}
            />
          ))}
        </span>
        <Square className="size-3 fill-current" />
      </Button>
    );
  }

  return (
    <div className="flex items-center">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={start}
        disabled={disabled}
        aria-label={`Dictate (${language === "es-419" ? "Spanish" : "English"})`}
        className="rounded-full"
      >
        <Mic />
      </Button>
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label="Dictation language"
        className={cn(
          "rounded-md px-1 text-2xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        )}
      >
        {LANGUAGES.find((l) => l.code === language)?.label}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";

/** The languages a device's voice is looked up by, for each of the app's. */
const VOICE_LANGS: Record<string, string[]> = { en: ["en"], ar: ["ar"], ckb: ["ckb", "ku"] };

/**
 * A practice task's video (G5) with its captions in the person's language,
 * and a voice (plan 4, step 5): ticked, each caption is read aloud as it
 * comes, by this device's own voice for the language. A device with none for
 * it says so; the captions still show the words.
 */
export function TaskVideo({
  src,
  captions,
  locale,
}: {
  src: string;
  captions: string;
  locale: string;
}) {
  const { t } = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [aloud, setAloud] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoice(null);
      return;
    }
    const pick = () => {
      const want = VOICE_LANGS[locale] ?? [locale];
      const all = window.speechSynthesis.getVoices();
      setVoice(all.find((v) => want.some((w) => v.lang.toLowerCase().startsWith(w))) ?? null);
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick);
  }, [locale]);

  useEffect(() => {
    const v = video.current;
    const track = v?.textTracks[0];
    if (!v || !track || !aloud || !voice) return;
    track.mode = "showing";
    const speak = () => {
      const cue = track.activeCues?.[0] as VTTCue | undefined;
      if (!cue) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(cue.text);
      u.voice = voice;
      u.lang = voice.lang;
      window.speechSynthesis.speak(u);
    };
    track.addEventListener("cuechange", speak);
    return () => {
      track.removeEventListener("cuechange", speak);
      window.speechSynthesis.cancel();
    };
  }, [aloud, voice]);

  return (
    <div className="grid" style={{ gap: 6 }}>
      <video ref={video} controls preload="none" src={src} width={480}>
        <track kind="captions" srcLang={locale} src={captions} default />
      </video>
      <label className="chip" style={{ width: "fit-content" }}>
        <input
          type="checkbox"
          checked={aloud}
          disabled={voice === null}
          onChange={(e) => setAloud(e.target.checked)}
          data-testid="video-aloud"
        />{" "}
        {t("Read the words aloud")}
      </label>
      {voice === null && (
        <span className="muted" style={{ fontSize: ".8rem" }} data-testid="video-no-voice">
          {t("This device has no voice for this language: the captions show the words.")}
        </span>
      )}
    </div>
  );
}

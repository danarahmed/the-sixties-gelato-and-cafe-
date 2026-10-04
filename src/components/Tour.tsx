"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/I18nProvider";
import { TOURS, tourFor, type Tour, type TourStep } from "@/lib/tours";
import { Icon } from "@/components/Icon";

/** Asks the page's tour to start. */
const START = "sixties:tour";
/** Says a tour was seen, or declined: its offer goes. */
const SEEN = "sixties:tour-seen";
const stored = (key: string) => `sixties.tour.${key}`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(stored(key));
  } catch {
    return null;
  }
}
function keep(key: string, value: "seen" | "no") {
  try {
    window.localStorage.setItem(stored(key), value);
  } catch {
    // A browser that keeps nothing offers the tour again next time: no harm.
  }
  window.dispatchEvent(new CustomEvent(SEEN, { detail: key }));
}

/** Starts a page's tour, from its offer or the menu. */
export function startTour(key: string) {
  window.dispatchEvent(new CustomEvent(START, { detail: key }));
}

/** The first of a step's places that is on the page, with a size. */
function placeOf(step: TourStep): HTMLElement | null {
  for (const sel of step.at) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    // Shown, and not a drawer slid off the side of the screen (the menu on a phone).
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth) return el;
  }
  return null;
}

/**
 * The offer of a page's tour, where the page puts it (round six): once per
 * device, until it is taken or declined. The menu's "Show me around this
 * screen" takes it again whenever.
 */
export function TourOffer({ tourKey }: { tourKey: string }) {
  const { t } = useT();
  // Nothing on the server: what this device has seen is known only in the browser.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const look = () => setShown(read(tourKey) === null);
    look();
    window.addEventListener(SEEN, look);
    return () => window.removeEventListener(SEEN, look);
  }, [tourKey]);
  if (!shown) return null;
  return (
    <div className="tour-offer no-print" data-testid="tour-offer">
      <Icon name="compass" size={18} />
      <span>{t("New here? Let us show you around this screen.")}</span>
      <span className="tour-offer-acts">
        <button
          type="button"
          className="btn-soft"
          onClick={() => startTour(tourKey)}
          data-testid="tour-start"
        >
          {t("Show me around")}
        </button>
        <button
          type="button"
          className="tour-no"
          onClick={() => keep(tourKey, "no")}
          data-testid="tour-no"
        >
          {t("No thanks")}
        </button>
      </span>
    </div>
  );
}

/** In the menu, for a page with a tour: take it again. */
export function TourMenuItem() {
  const { t } = useT();
  const tour = tourFor(usePathname());
  if (!tour) return null;
  return (
    <button
      type="button"
      className="nav-tour"
      onClick={() => startTour(tour.key)}
      data-testid="tour-menu"
    >
      <Icon name="compass" size={18} />
      {t("Show me around this screen")}
    </button>
  );
}

interface Run {
  tour: Tour;
  steps: TourStep[];
  i: number;
}

/**
 * The tour itself, over the page: the part of the screen a step is about,
 * lit, the rest dimmed, and beside it what it is for, the step's number and
 * the way on and back. The keyboard is held in it (Escape ends it, the
 * arrows go on and back, the way the reader reads); ended or finished, it is
 * not offered again on this device, and the keyboard goes back where it was.
 */
export function TourRunner() {
  const { t, dir } = useT();
  const pathname = usePathname();
  const [run, setRun] = useState<Run | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const go = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      const tour = TOURS.find((x) => x.key === key && x.path === pathname);
      if (!tour) return;
      // The steps whose part the page shows now: the rest are passed over.
      const steps = tour.steps.filter((s) => placeOf(s) !== null);
      if (steps.length === 0) return;
      back.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setRun({ tour, steps, i: 0 });
    };
    window.addEventListener(START, go);
    return () => window.removeEventListener(START, go);
  }, [pathname]);

  // Another page: the tour of this one ends there.
  useEffect(() => {
    setRun(null);
  }, [pathname]);

  const step = run ? run.steps[run.i] : null;
  useLayoutEffect(() => {
    if (!step) return;
    const el = placeOf(step);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useEffect(() => {
    if (run) next.current?.focus();
  }, [run]);

  if (!run || !step || typeof document === "undefined") return null;
  const last = run.i === run.steps.length - 1;
  const end = () => {
    keep(run.tour.key, "seen");
    setRun(null);
    back.current?.focus?.();
  };
  const go = (by: number) => {
    const i = run.i + by;
    if (i < 0) return;
    if (i >= run.steps.length) end();
    else setRun({ ...run, i });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const on = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const prev = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    if (e.key === "Escape") end();
    else if (e.key === on) go(1);
    else if (e.key === prev) go(-1);
    else if (e.key === "Tab") {
      // The keyboard stays in the tour's card.
      const card = e.currentTarget.querySelector<HTMLElement>(".tour-card");
      const all = card ? [...card.querySelectorAll<HTMLElement>("button")] : [];
      const first = all[0];
      const final = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        final?.focus();
      } else if (!e.shiftKey && document.activeElement === final) {
        e.preventDefault();
        first?.focus();
      }
    } else return;
    if (e.key !== "Tab") {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Where the card stands: under the part lit, or over it, or, for a part as
  // tall as the screen, at the foot of the screen.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(340, vw - 24);
  const pad = 6;
  const spot = rect && {
    top: Math.max(rect.top - pad, 4),
    left: Math.max(rect.left - pad, 4),
    width: Math.min(rect.width + pad * 2, vw - 8),
    height: Math.min(rect.bottom + pad, vh - 4) - Math.max(rect.top - pad, 4),
  };
  const card: CSSProperties = { width };
  if (spot) {
    const start = dir === "rtl" ? spot.left + spot.width - width : spot.left;
    card.left = Math.min(Math.max(start, 12), vw - width - 12);
    if (vh - (spot.top + spot.height) >= 210) card.top = spot.top + spot.height + 12;
    else if (spot.top >= 210) card.bottom = vh - spot.top + 12;
    else {
      card.bottom = 16;
      card.left = (vw - width) / 2;
    }
  } else {
    card.top = vh / 2 - 100;
    card.left = (vw - width) / 2;
  }

  return createPortal(
    <div
      className="tour-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-text"
      onKeyDown={onKey}
      data-testid="tour"
      data-tour={run.tour.key}
      data-step={run.i + 1}
    >
      {spot ? (
        <div className="tour-spot" style={spot} aria-hidden="true" />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      <div className="tour-card" style={card}>
        <div className="tour-count">
          {t("Step {n} of {total}", { n: run.i + 1, total: run.steps.length })}
        </div>
        <h2 id="tour-title">{t(step.title)}</h2>
        <p id="tour-text">{t(step.text)}</p>
        <div className="tour-dots" aria-hidden="true">
          {run.steps.map((_, i) => (
            <span key={i} className={i === run.i ? "on" : undefined} />
          ))}
        </div>
        <div className="tour-acts">
          <button type="button" className="tour-no" onClick={end} data-testid="tour-end">
            {t("End the tour")}
          </button>
          <span className="sp" />
          {run.i > 0 && (
            <button type="button" className="btn-soft" onClick={() => go(-1)}>
              {t("Back")}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            ref={next}
            onClick={() => go(1)}
            data-testid="tour-next"
          >
            {last ? t("Finish") : t("Next")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

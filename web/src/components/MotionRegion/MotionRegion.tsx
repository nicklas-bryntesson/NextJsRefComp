/* MotionRegion — React port of
 * reference-components/src/partials/components/MotionRegion (ADR-0010).
 *
 * 'use client' is unavoidable here, and for a principled reason: every one of the
 * component's five signals is a *live browser* signal (matchMedia,
 * navigator.connection, IntersectionObserver) plus user intent. Unlike AffixField
 * — whose JS only computes attributes and therefore ports to a Server Component —
 * this component's whole job is to react to the environment.
 *
 * The component stays THIN, exactly as the contract demands: it gathers signals,
 * tracks intent, asks the pure `motion-policy` kernel what the state should be,
 * and projects the answer onto the root as `data-motion`. `resolveMotion` is the
 * only decision path, and here it is a plain derivation during render rather than
 * an effect — so the projected attribute cannot drift from the signals. Signal
 * gathering is deliberately NOT folded into the kernel: ADR-0010's "Reconsider
 * when" says to do that once a *second* motion component needs it, and
 * MotionRegion is the only consumer today.
 *
 * `data-motion` is absent until the component initializes (the `.md` says so
 * explicitly). In React that is not a stylistic choice: `prefers-reduced-motion`
 * is a media query and cannot be read during SSR, so the server has no honest
 * value to emit, and the first client render must match the server HTML. The
 * environment signals are therefore read through `useSyncExternalStore`, whose
 * server snapshot is "nothing known yet" — which is also what makes the
 * pre-hydration window explicit rather than accidental. See
 * findings/MotionRegion.md.
 *
 * Class names are structural: `.MotionRegion` and `.control` are both selected by
 * the conformance suite and by the verbatim stylesheet. Preserved exactly;
 * utilities layer alongside them in Phase B, never instead. (Findings F-008.)
 */

"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  evaluateMotionPolicy,
  resolveMotion,
  type MotionState,
} from "@/kernel/motion-policy";

import "./MotionRegion.layered.css";

/* navigator.connection (Network Information API) is not in the standard DOM lib. */
interface NetworkInformationLike {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

/** Visibility threshold: motion is "in view" once 40 % of the region intersects —
 *  the same fraction the reference (and its source) used. */
const VISIBILITY_THRESHOLD = 0.4;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const ICON_PATHS = {
  play: "M8 5v14l11-7z",
  pause: "M6 4h4v16H6zm8 0h4v16h-4z",
} as const;

/* ── Environment signals as external stores ───────────────────────────────────
 * matchMedia and navigator.connection are exactly what useSyncExternalStore is
 * for: mutable browser state outside React, with a subscribe/snapshot shape and
 * an explicit *server* snapshot. Using it instead of useEffect+setState is what
 * keeps SSR honest (the server snapshot is the only value the server can know)
 * and keeps the reads out of an effect body. */

const noopSubscribe = () => () => {};
const getHydrated = () => true;
const getHydratedServer = () => false;

function hasMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function subscribeReducedMotion(onChange: () => void) {
  if (!hasMatchMedia()) return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getReducedMotion = () => (hasMatchMedia() ? window.matchMedia(REDUCED_MOTION).matches : false);
const getReducedMotionServer = () => false;

function getConnection(): NetworkInformationLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
  };
  return nav.connection || nav.mozConnection || null;
}

function subscribeConnection(onChange: () => void) {
  const connection = getConnection();
  connection?.addEventListener?.("change", onChange);
  return () => connection?.removeEventListener?.("change", onChange);
}

/* Snapshots must be comparable by identity, so the two connection signals travel
   as one primitive string rather than a fresh object per read. */
const getConnectionSnapshot = () => {
  const connection = getConnection();
  return `${connection?.saveData ? "1" : "0"}|${connection?.effectiveType ?? ""}`;
};
const getConnectionServerSnapshot = () => "0|";

export type MotionRegionProps = {
  /** The e2e anchor. Rendered as `data-id`. */
  id?: string;
  /** Author opt-in — the autostart gate. `"policy"` (default) autostarts when
   *  unblocked; `"off"` never autostarts, but the user can still play. */
  autoplay?: "off" | "policy";
  /** Accessible labels for the toggle. The label names the NEXT action. */
  playText?: string;
  pauseText?: string;
  /** Utilities/extra classes. `.MotionRegion` is always applied. */
  className?: string;
  /** The animated backend — authored content that obeys `data-motion` in its own
   *  idiom. A CSS backend needs nothing from this component but one gated rule. */
  children?: ReactNode;
};

export function MotionRegion({
  id,
  autoplay = "policy",
  playText = "Play video",
  pauseText = "Pause video",
  className,
  children,
}: MotionRegionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** Guards against overlapping play()/pause() calls ("play() interrupted by
   *  pause()") when a redundant resolve produces the same state. */
  const appliedVideoState = useRef<MotionState | null>(null);

  /* Live signals. */
  const initialized = useSyncExternalStore(noopSubscribe, getHydrated, getHydratedServer);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getReducedMotionServer,
  );
  const connectionSnapshot = useSyncExternalStore(
    subscribeConnection,
    getConnectionSnapshot,
    getConnectionServerSnapshot,
  );
  const [saveDataFlag, effectiveType] = connectionSnapshot.split("|");
  const saveData = saveDataFlag === "1";

  /* Visibility is the one signal with no store shape: IntersectionObserver pushes
     entries to a callback, so it stays useState + an effect (setState from an
     observer callback, never from the effect body). Starts true, as in the
     reference, so a region already in view never flickers through paused. */
  const [visible, setVisible] = useState(true);

  /* User intent. Owned here, never recovered from a DOM event — the native
     `pause` event carries no "who paused" information (ADR-0010 risk 3). */
  const [userPaused, setUserPaused] = useState(false);
  const [userStarted, setUserStarted] = useState(false);

  const generatedVideoId = useId();
  const [videoId, setVideoId] = useState<string | undefined>(undefined);

  /* The single application point — a derivation, not an effect. */
  const policy = evaluateMotionPolicy({
    autoplay,
    reducedMotion,
    visible,
    saveData,
    effectiveType,
  });
  const motion = resolveMotion(policy, { userPaused, userStarted });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setVisible(entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD);
      },
      { threshold: VISIBILITY_THRESHOLD },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  /* The video adapter. Video is the one backend that needs imperative driving, so
     it is built in — including the performance gate: `preload="none"` means no
     media bytes download until policy actually says play. The element is queried
     from the DOM rather than taken as a prop because the media is *authored
     content* the region governs, not something the region owns — which also means
     "is there a video here?" is only answerable after the first commit. */
  useEffect(() => {
    const video = rootRef.current?.querySelector("video") ?? null;
    videoRef.current = video;
    if (!video) return;
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.controls = false;
    video.preload = "none";
    if (!video.id) video.id = generatedVideoId;
    /* One bounded, idempotent state write: it publishes aria-controls for the
       toggle, and cannot cascade because the id never changes afterwards. */
    setVideoId(video.id);
  }, [generatedVideoId, children]);

  useEffect(() => {
    const video = videoRef.current;
    if (!initialized || !video) return;
    if (motion === appliedVideoState.current) return;
    appliedVideoState.current = motion;
    if (motion === "running") {
      /* play() rejects when the platform blocks autoplay; motion simply stays put. */
      void Promise.resolve(video.play()).catch(() => {});
    } else {
      video.pause();
    }
  }, [initialized, motion]);

  /* A plain handler, not useCallback: the React Compiler is enabled in this app
     and refuses to compile a component whose hand-written memoization it cannot
     preserve ("Compilation Skipped: Existing memoization could not be
     preserved"). Letting the compiler own the memoization is the idiomatic
     answer here. See findings/MotionRegion.md. */
  function onToggle() {
    if (motion === "running") {
      setUserPaused(true);
      setUserStarted(false);
    } else {
      setUserStarted(true);
      setUserPaused(false);
    }
  }

  const running = motion === "running";

  return (
    <div
      ref={rootRef}
      /* PHASE B. `.MotionRegion` stays first and contractual; the rest is the
         stylesheet, which dissolved entirely — see MotionRegion.css. */
      className={
        className ? `MotionRegion relative ${className}` : "MotionRegion relative"
      }
      data-component="MotionRegion"
      data-id={id}
      data-autoplay={autoplay}
      data-play-text={playText}
      data-pause-text={pauseText}
      /* Absent until initialized — the contract's own wording, and the only
         honest value on the server. */
      data-motion={initialized ? motion : undefined}
      data-initialized={initialized ? "true" : undefined}
    >
      {/* The WCAG 2.2.2 pause control. Rendered only once initialized, mirroring
          the reference (which injects it in init()): a control rendered before
          any policy is known would be a dead button without JS, and the
          progressive-enhancement floor is the <noscript> native-controls video. */}
      {initialized && (
        <button
          type="button"
          className={
            /* Every one of the control's declarations was a VALUE, so all of them
               moved. `top-base end-base` for the reference's
               `inset-block-start`/`inset-inline-end`: `end-` is logical, and
               block-start is `top` in every horizontal writing mode, which is the
               only mode this component is used in.
               The scrim and the white stay hard-coded, as arbitrary values rather
               than tokens, because the reference's reason is sound and is not a
               bypass: the control sits over authored media whose contrast is
               unknowable, so it owns its own. */
            "control absolute top-base end-base z-[2] grid place-items-center " +
            /* `rounded-[50%]`, not `rounded-full`: Tailwind's `rounded-full` is
               `calc(infinity * 1px)`, which is a stadium, while 50% is an
               ellipse. Identical for this square control and NOT equivalent in
               general — the computed-style diff is the only thing that caught
               it, which is the argument for taking the snapshot. */
            "size-11 cursor-pointer rounded-[50%] border-none p-0 " +
            "bg-[oklch(0_0_0/0.5)] text-white backdrop-blur-[4px] " +
            "[-webkit-tap-highlight-color:transparent] " +
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          }
          aria-label={running ? pauseText : playText}
          aria-controls={videoId}
          data-icon={running ? "pause" : "play"}
          onClick={onToggle}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5">
            <path d={running ? ICON_PATHS.pause : ICON_PATHS.play} />
          </svg>
        </button>
      )}
      {children}
    </div>
  );
}

export default MotionRegion;

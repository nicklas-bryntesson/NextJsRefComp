"use client";

/* CoverCompositionVideo.tsx — the video variant of `_CoverComposition.cshtml`,
 * with the behaviour of `ClientApp/js/utils/CoverCompositionVideo.ts`.
 *
 * SCOPE, stated plainly. The source class is a 7-state machine
 * (idle / ready / playing / pausedByUser / pausedByPolicy / blocked / error)
 * driven by five policy blockers (autoplay attribute, prefers-reduced-motion,
 * intersection visibility, Save-Data, effectiveType). This port carries the
 * state names, the `data-video-state` reflection the CSS and any host script
 * would read, and the four policy blockers that are observable without the
 * non-standard `NetworkInformation` surface the source uses unguarded. The two
 * connection blockers are implemented behind a feature test rather than dropped.
 *
 * TWO DELIBERATE DIVERGENCES from the source, both recorded:
 *
 * · The source INJECTS `.video-controls` / `.video-toggle` from JS and ships a
 *   `<noscript>` block containing a SECOND `<video>` with native `controls`.
 *   We server-render the controls and put native `controls` on the one video,
 *   then hand over on enhancement. One video element, no duplicate download,
 *   and the control is live before hydration instead of ~100 ms after it —
 *   which is the dead-control window CLAUDE.md F-035 measured. F-069.
 *
 * · Enhancement state comes from `useSyncExternalStore`, not
 *   `useEffect(() => setState(true), [])`, which is a lint error in this repo
 *   (`react-hooks/set-state-in-effect`) and one commit slower. Precedent:
 *   `src/components/ScrollArea/ScrollArea.tsx`.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import "./CoverComposition.css";

export type VideoState =
  | "idle"
  | "ready"
  | "playing"
  | "pausedByUser"
  | "pausedByPolicy"
  | "blocked"
  | "error";

export type CoverCompositionVideoProps = {
  title: string;
  preamble?: string;
  videoSrc: string;
  posterSrc?: string;
  headingLevel?: "h1" | "h2" | "h3";
  actions?: ReactNode;
  /** Source `data-autoplay`. `"policy"` = autoplay if no blocker objects. */
  autoplay?: "policy" | "never";
  /** Source `data-play-text` / `data-pause-text`. Same defaults as the class. */
  playText?: string;
  pauseText?: string;
};

/* Asymmetric snapshots: server renders the unenhanced tree, client the enhanced
 * one, and the swap resolves inside the hydration pass. */
const noopSubscribe = () => () => {};
const useIsEnhanced = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** The two blockers the source reads off `navigator.connection`, feature-tested. */
function connectionBlocked() {
  const c = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

export function CoverCompositionVideo({
  title,
  preamble,
  videoSrc,
  posterSrc,
  headingLevel = "h2",
  actions,
  autoplay = "policy",
  playText = "Play video",
  pauseText = "Pause video",
}: CoverCompositionVideoProps) {
  const Heading = headingLevel;
  const enhanced = useIsEnhanced();

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  /* Driven by media events and observers, never set synchronously in an effect,
   * so plain `useState` is correct here (`set-state-in-effect` targets only the
   * latter). */
  const [state, setState] = useState<VideoState>("idle");

  /* NOT MIRRORED FROM STATE. The first version was
   *   const [userPaused, setUserPaused] = useState(false);
   *   const userPausedRef = useRef(false);
   *   useEffect(() => { userPausedRef.current = userPaused; }, [userPaused]);
   * which is the standard "give my event listeners a fresh value" idiom, and
   * `react-hooks/immutability` rejects it: "Modifying a value used previously in
   * an effect function or as an effect dependency is not allowed."
   *
   * The rule was right and the fix is smaller than the thing it replaced. Nothing
   * in the render tree reads `userPaused` — only the pause handler and the policy
   * arbiter do — so the `useState` was never state, and mirroring it into a ref
   * was a workaround for having declared it as state in the first place. One ref,
   * written only from event handlers, and the mirroring effect disappears along
   * with a render per user pause. F-089.
   */
  const userPausedRef = useRef(false);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
    } catch {
      /* The source's PLAY_REJECTED edge: a rejected play() is a policy refusal,
         not an error, and it must not look like a broken video. */
      setState("blocked");
    }
  }, []);

  /* Media events → state. This is the source's `setupVideoEvents` + `transition`. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    /* Take over from the native controls we server-rendered, exactly as the
       source's `setupVideoElement` does. */
    video.controls = false;
    const onCanPlay = () => setState((s) => (s === "idle" ? "ready" : s));
    const onPlay = () => setState("playing");
    const onPause = () =>
      setState(() =>
        userPausedRef.current ? "pausedByUser" : "pausedByPolicy",
      );
    const onError = () => setState("error");
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);
    if (video.readyState >= 3) onCanPlay();
    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
    };
  }, []);

  /* Policy arbitration: visibility × reduced motion × connection × autoplay. */
  useEffect(() => {
    const root = mediaRef.current;
    const video = videoRef.current;
    if (!root || !video) return;
    if (autoplay !== "policy") return;

    let visible = false;
    const arbitrate = () => {
      const blocked = !visible || prefersReducedMotion() || connectionBlocked();
      if (!blocked && video.paused && !userPausedRef.current) void play();
      if (blocked && !video.paused) video.pause();
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible = e.isIntersecting;
        arbitrate();
      },
      { threshold: 0.25 },
    );
    io.observe(root);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", arbitrate);
    return () => {
      io.disconnect();
      mq.removeEventListener("change", arbitrate);
    };
  }, [autoplay, play]);

  const isPlaying = state === "playing";
  const onToggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      void play();
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  };

  return (
    <div
      className="CoverComposition"
      data-component="CoverCompositionVideo"
      data-autoplay={autoplay}
      data-video-state={state}
      /* Booleans are `="true"` or absent, never `="false"` — CLAUDE.md. */
      data-initialized={enhanced ? "true" : undefined}
    >
      <div className="media-container" role="presentation" ref={mediaRef}>
        <span className="overlay" />
        <video
          ref={videoRef}
          className="enhancedVideo"
          playsInline
          preload="metadata"
          muted
          loop
          poster={posterSrc}
          /* SSR carries native controls so the video is operable with no JS at
             all; the effect above removes them on enhancement. F-069. */
          controls={!enhanced}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>

        {enhanced ? (
          <div className="video-controls">
            <button
              type="button"
              className="video-toggle"
              aria-label={isPlaying ? pauseText : playText}
              aria-pressed={isPlaying}
              onClick={onToggle}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d={isPlaying ? "M6 5h4v14H6zm8 0h4v14h-4z" : "M8 5v14l11-7z"}
                />
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      <div className="content-container">
        <div className="content">
          <Heading className="CoverComposition-heading">{title}</Heading>
          {preamble ? (
            <div className="Prose">
              <p>{preamble}</p>
            </div>
          ) : null}
          {actions ? (
            <div className="link-group flex flex-wrap gap-sm">{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

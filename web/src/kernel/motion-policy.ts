/* motion-policy — kernel primitive, ported from
 * reference-components/src/kernel/js/motion-policy.ts (ADR-0010).
 *
 * Deliberately a PLAIN MODULE, not a hook. It has no DOM, no browser globals and
 * no React: signals in, decision out. Keeping it framework-agnostic is what lets
 * the same governance be shared by every motion backend and unit-tested
 * exhaustively without a renderer (see web/src/kernel/tests/motion-policy.test.ts,
 * adapted from the reference's own conformance test).
 *
 * The three tiers, and NOT conflating them, are the whole point:
 *
 *   1. Autostart gate (data-autoplay) — governs only whether motion may start on
 *      its own. Never a reason to stop motion the user started.
 *   2. Cost blockers (reduced-motion, save-data, slow link) — hold back autostart,
 *      but an explicit user play overrides them: the user accepted the cost.
 *   3. Visibility — universal. Off-screen always pauses (pure perf), for both
 *      autostarted and user-started motion, and resumes on return.
 */

/** The environment signals that gate decorative motion. Plain data, so the
 *  evaluation is pure; the component reads them from the platform. */
export interface MotionSignals {
  /** Authored autostart opt-in. `'policy'` may autostart when unblocked; `'off'` never autostarts. */
  autoplay: "off" | "policy";
  /** `prefers-reduced-motion: reduce` matches. */
  reducedMotion: boolean;
  /** The region is sufficiently in view (the component owns the threshold). */
  visible: boolean;
  /** `navigator.connection.saveData`. */
  saveData: boolean;
  /** `navigator.connection.effectiveType` — `''` when the API is unavailable. */
  effectiveType: string;
}

/** Reasons motion is expensive/unwelcome right now. Each holds back autostart, but
 *  all are overridden by an explicit user play. Visibility is deliberately NOT
 *  here: it is universal, not overridable. */
export interface CostBlockers {
  reducedMotion: boolean;
  saveData: boolean;
  slowConnection: boolean;
}

export interface MotionPolicy {
  /** The region is in view. Universal gate — off-screen always pauses. */
  visible: boolean;
  /** `data-autoplay === 'policy'`. Whether autostart is even permitted. */
  autoplayEnabled: boolean;
  costBlockers: CostBlockers;
  /** Any cost blocker active. */
  anyCostBlocker: boolean;
  /** Would motion auto-start now: opted in, no cost blocker, and in view. */
  autostart: boolean;
}

/** What the user has explicitly asked for. Owned by the component, never inferred
 *  from a DOM event (the native `pause` event carries no intent). */
export interface MotionIntent {
  /** The user explicitly paused — wins over everything. */
  userPaused: boolean;
  /** The user explicitly started motion and has not paused since — overrides the cost blockers. */
  userStarted: boolean;
}

export type MotionState = "running" | "paused";

const SLOW_CONNECTIONS = new Set(["slow-2g", "2g"]);

/** Reduce the raw signals to the three tiers. Pure: same signals in, same policy out. */
export function evaluateMotionPolicy(signals: MotionSignals): MotionPolicy {
  const costBlockers: CostBlockers = {
    reducedMotion: signals.reducedMotion,
    saveData: signals.saveData,
    slowConnection: SLOW_CONNECTIONS.has(signals.effectiveType),
  };

  const anyCostBlocker = Object.values(costBlockers).some(Boolean);
  const autoplayEnabled = signals.autoplay === "policy";
  const visible = signals.visible;

  return {
    visible,
    autoplayEnabled,
    costBlockers,
    anyCostBlocker,
    autostart: autoplayEnabled && !anyCostBlocker && visible,
  };
}

/** Resolve policy against user intent into the target motion state. Pure, and the
 *  single decision function — there is no second, imperative path.
 *
 *  Precedence:
 *    1. An explicit user pause always wins → paused.
 *    2. Off-screen always pauses → paused (universal perf gate; applies even to
 *       user-started motion, and resumes when the region returns to view).
 *    3. The user explicitly started → running (every cost blocker and the autostart
 *       gate are overridden; the user accepted the cost, and an OS setting change
 *       does not revoke an active choice).
 *    4. Autostart is permitted → running (visibility already cleared at step 2).
 *    5. Otherwise → paused.
 */
export function resolveMotion(policy: MotionPolicy, intent: MotionIntent): MotionState {
  if (intent.userPaused) return "paused";
  if (!policy.visible) return "paused";
  if (intent.userStarted) return "running";
  if (policy.autostart) return "running";
  return "paused";
}

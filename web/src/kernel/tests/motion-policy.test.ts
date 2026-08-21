/* motion-policy conformance — adapted from
 * reference-components/src/kernel/js/tests/motion-policy.unit.test.ts.
 *
 * PORTING.md excludes *.unit.test.* from the portable contract because the
 * reference unit tests are white-box (they call private methods of the reference
 * classes). This one is the exception that proves the rule: motion-policy is two
 * pure functions with a documented public API, so its "unit" test is already
 * black-box. It was re-pointed at our port with a ONE-LINE change — the import
 * specifier — and nothing else. See findings/MotionRegion.md.
 */
import { describe, it, expect } from 'vitest'
import {
  evaluateMotionPolicy,
  resolveMotion,
  type MotionSignals,
  type MotionPolicy,
  type MotionIntent,
} from "../motion-policy"

// A fully-unblocked baseline: opted in, motion allowed, visible, fast link.
function clearSignals(overrides: Partial<MotionSignals> = {}): MotionSignals {
  return {
    autoplay: 'policy',
    reducedMotion: false,
    visible: true,
    saveData: false,
    effectiveType: '4g',
    ...overrides,
  }
}

function intent(overrides: Partial<MotionIntent> = {}): MotionIntent {
  return { userPaused: false, userStarted: false, ...overrides }
}

describe('evaluateMotionPolicy', () => {
  it('permits autostart when opted in, visible, and nothing costs', () => {
    const policy = evaluateMotionPolicy(clearSignals())
    expect(policy.autostart).toBe(true)
    expect(policy.autoplayEnabled).toBe(true)
    expect(policy.visible).toBe(true)
    expect(policy.anyCostBlocker).toBe(false)
  })

  it('denies autostart when not opted in (autoplay off) — but that is only the autostart gate', () => {
    const policy = evaluateMotionPolicy(clearSignals({ autoplay: 'off' }))
    expect(policy.autoplayEnabled).toBe(false)
    expect(policy.autostart).toBe(false)
    expect(policy.anyCostBlocker).toBe(false) // autoplay is NOT a cost blocker
  })

  it('treats reduced-motion / save-data as cost blockers', () => {
    expect(evaluateMotionPolicy(clearSignals({ reducedMotion: true })).costBlockers.reducedMotion).toBe(true)
    expect(evaluateMotionPolicy(clearSignals({ saveData: true })).costBlockers.saveData).toBe(true)
    expect(evaluateMotionPolicy(clearSignals({ reducedMotion: true })).autostart).toBe(false)
  })

  it('treats only slow-2g / 2g as a slow connection', () => {
    for (const effectiveType of ['slow-2g', '2g']) {
      expect(evaluateMotionPolicy(clearSignals({ effectiveType })).costBlockers.slowConnection).toBe(true)
    }
    for (const effectiveType of ['3g', '4g', '']) {
      expect(evaluateMotionPolicy(clearSignals({ effectiveType })).costBlockers.slowConnection).toBe(false)
    }
  })

  it('keeps visibility out of the cost blockers (it is universal, not overridable)', () => {
    const policy = evaluateMotionPolicy(clearSignals({ visible: false }))
    expect(policy.visible).toBe(false)
    expect(policy.anyCostBlocker).toBe(false)
    expect(policy.autostart).toBe(false) // autostart still requires visibility
  })

  it('aggregates anyCostBlocker across the three cost signals', () => {
    expect(evaluateMotionPolicy(clearSignals()).anyCostBlocker).toBe(false)
    expect(evaluateMotionPolicy(clearSignals({ saveData: true, reducedMotion: true })).anyCostBlocker).toBe(true)
  })
})

describe('resolveMotion', () => {
  const clean = (): MotionPolicy => evaluateMotionPolicy(clearSignals())
  const off = (): MotionPolicy => evaluateMotionPolicy(clearSignals({ autoplay: 'off' }))
  const reducedMotion = (): MotionPolicy => evaluateMotionPolicy(clearSignals({ reducedMotion: true }))
  const saveData = (): MotionPolicy => evaluateMotionPolicy(clearSignals({ saveData: true }))
  const offscreen = (): MotionPolicy => evaluateMotionPolicy(clearSignals({ visible: false }))

  it('autostarts under clean policy with no intent', () => {
    expect(resolveMotion(clean(), intent())).toBe('running')
  })

  // Tier 1: explicit pause always wins
  it('an explicit user pause wins, even under clean policy', () => {
    expect(resolveMotion(clean(), intent({ userPaused: true }))).toBe('paused')
  })

  it('an explicit pause beats an explicit start', () => {
    expect(resolveMotion(clean(), intent({ userPaused: true, userStarted: true }))).toBe('paused')
  })

  // Tier 3: 'off' gates autostart only — a user can still play
  it('does not autostart when autoplay is off', () => {
    expect(resolveMotion(off(), intent())).toBe('paused')
  })

  it('lets the user start motion even when autoplay is off (the bug the flat model had)', () => {
    expect(resolveMotion(off(), intent({ userStarted: true }))).toBe('running')
  })

  // Tier 2: cost blockers hold back autostart but an explicit start overrides them
  it('does not autostart under a cost blocker', () => {
    expect(resolveMotion(reducedMotion(), intent())).toBe('paused')
    expect(resolveMotion(saveData(), intent())).toBe('paused')
  })

  it('lets an explicit start override reduced-motion and save-data', () => {
    expect(resolveMotion(reducedMotion(), intent({ userStarted: true }))).toBe('running')
    expect(resolveMotion(saveData(), intent({ userStarted: true }))).toBe('running')
  })

  // Tier: visibility is universal — off-screen pauses even user-started motion
  it('pauses off-screen even when the user started it (perf; resumes on return)', () => {
    expect(resolveMotion(offscreen(), intent({ userStarted: true }))).toBe('paused')
  })

  it('pauses off-screen under clean policy', () => {
    expect(resolveMotion(offscreen(), intent())).toBe('paused')
  })
})

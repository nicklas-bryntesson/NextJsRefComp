/* Kernel conformance for `popup-position`, adapted from
 * `reference-components/src/kernel/js/tests/popup-position.unit.test.ts`.
 *
 * Every assertion below is the reference's, unchanged — only the import path
 * differs. The kernel README calls these three functions "black-box-portable:
 * port the function, run the conformance test against your implementation", so
 * this is a faithfulness proof, not a white-box test of our internals.
 */
import { describe, it, expect } from 'vitest'
import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../popup-position'

describe('calculatePopupOffset', () => {
  it('centers bubble when trigger is in the middle of the container', () => {
    // container: 0–1000px, popup: 200px, trigger center: 500px
    // idealLeft = 500, clamp(100, 500, 900) = 500, result = 50%
    expect(calculatePopupOffset(500, 0, 1000, 200, 1200)).toBeCloseTo(50)
  })

  it('clamps to minimum when trigger is near left edge', () => {
    // idealLeft = 50, min = 100 (popupWidth/2), clamped = 100, result = 10%
    expect(calculatePopupOffset(50, 0, 1000, 200, 1200)).toBeCloseTo(10)
  })

  it('clamps at viewport right edge', () => {
    // trigger at 1150, container [0,1000], viewport 1200, no inset
    // maxLeft = 1200 - 0 - 100 = 1100, idealLeft = 1150 → clamped = 1100
    // result = 1100/1000*100 = 110% (bubble hangs outside container right — intentional)
    // bubbleLeft = 0 + 1100 - 100 = 1000, bubbleRight = 1200 = viewport edge ✓
    expect(calculatePopupOffset(1150, 0, 1000, 200, 1200)).toBeCloseTo(110)
  })

  it('respects viewportInset on left edge — bubble stays inset px from viewport left', () => {
    // trigger at x=10, container spans -590..610 (width=1200, centered on trigger)
    // idealLeft = 10 - (-590) = 600
    // viewportMin = 590 + 100 + 12 = 702  (inset pushes min right)
    // containerMin = 100  → effective min = 702
    // clampedLeft = 702  → result = 702/1200*100 = 58.5%
    // bubbleLeft = -590 + 702 - 100 = 12px  ✓ exactly the inset
    expect(calculatePopupOffset(10, -590, 1200, 200, 1200, 12)).toBeCloseTo(58.5)
  })

  it('respects viewportInset on right edge — bubble stays inset px from viewport right', () => {
    // trigger at x=1190, container spans 590..1790 (width=1200, centered on trigger)
    // idealLeft = 1190 - 590 = 600
    // viewportMax = 1200 - 590 - 100 - 12 = 498  (inset pushes max left)
    // containerMax = 1100  → effective max = 498
    // clampedLeft = 498  → result = 498/1200*100 = 41.5%
    // bubbleRight = 590 + 498 + 100 = 1188 = 1200-12px  ✓ exactly the inset
    expect(calculatePopupOffset(1190, 590, 1200, 200, 1200, 12)).toBeCloseTo(41.5)
  })
})

describe('calculateArrowOffset', () => {
  it('returns 0 when popup is perfectly centered on trigger', () => {
    // triggerCenter: 500, popupLeft: 400, popupCenter: 500 → rawOffset = 0
    expect(calculateArrowOffset(500, 400, 200, 16, 12)).toBe(0)
  })

  it('clamps to positive limit when trigger is far right of popup center', () => {
    // rawOffset = 600 - 500 = 100, limit = 100 - 16 - 6 = 78 → clamped to 78
    expect(calculateArrowOffset(600, 400, 200, 16, 12)).toBeCloseTo(78)
  })

  it('clamps to negative limit when trigger is far left of popup center', () => {
    // rawOffset = 400 - (400 + 100) = -100, clamped to -78
    expect(calculateArrowOffset(400, 400, 200, 16, 12)).toBeCloseTo(-78)
  })
})

describe('detectDirection', () => {
  it('returns "top" when more space above', () => {
    expect(detectDirection({ top: 600, bottom: 620 }, 800)).toBe('top')
  })

  it('returns "bottom" when more space below', () => {
    expect(detectDirection({ top: 50, bottom: 70 }, 800)).toBe('bottom')
  })

  it('returns "top" when space above equals space below', () => {
    expect(detectDirection({ top: 400, bottom: 420 }, 820)).toBe('top')
  })
})

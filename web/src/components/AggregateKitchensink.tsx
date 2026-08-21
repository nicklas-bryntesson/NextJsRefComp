/* The full kitchensink — every ported component in one page.
 *
 * WHY THIS IS ALSO MOUNTED AT `/`:
 *
 * Nine of the eighteen component specs hard-code `await page.goto('/')` instead
 * of `goto(targetPath())`. Playwright resolves `'/'` against the ORIGIN of
 * `baseURL`, so `TARGET_PATH` is silently inert for those nine and they land on
 * whatever the host serves at the site root. PORTING.md documents `TARGET_PATH`
 * as the seam for "point the suite at your own page", so this is a real gap
 * between the documented contract and the suite — see Findings.md F-019.
 *
 * The reference repo never notices because its own `/` *is* the kitchensink. So
 * the honest fix on our side is the same shape: serve the aggregate kitchensink
 * at `/` too, rather than proxying `/` to a sub-route. Then both spec styles
 * work — `TARGET_PATH` still selects an isolated route for the nine that honour
 * it, and the nine that don't get a page containing their component.
 */

import { KitchensinkPage } from "./kitchensink-ui";

/* THE ORDER OF THESE IMPORTS IS LOAD-BEARING, not tidiness.
 *
 * Each component imports its own verbatim stylesheet, so this list determines
 * the module graph order and therefore the CSS cascade order. Several components
 * style a `.content` element at identical specificity (0,2,0) — `.Notice
 * .content{display:flex}`, `.ChoiceGroup .content`, `.Picklist
 * .content{display:flow-root}` — and the contracts NEST a Notice inside a
 * ChoiceGroup's and a Picklist's `.content`. So source order decides which wins,
 * and the loser silently drops `gap` and `min-inline-size: 0`.
 *
 * The reference has the same collision and resolves it with a hand-ordered
 * @import list. Alphabetical order happens to reproduce the reference's outcome
 * for both cases (ChoiceGroup before Notice, Picklist after it) — verified by
 * two independent ports measuring the computed value both ways. Keep it
 * alphabetical, and if a new component adds a `.content` rule, measure rather
 * than assume. See Findings.md F-025.
 */
import { AffixFieldKitchensink } from "./AffixField/AffixField.kitchensink";
import { ChoiceFieldKitchensink } from "./ChoiceField/ChoiceField.kitchensink";
import { ChoiceGroupKitchensink } from "./ChoiceGroup/ChoiceGroup.kitchensink";
import { DateFieldKitchensink } from "./DateField/DateField.kitchensink";
import { DateTimeFieldKitchensink } from "./DateTimeField/DateTimeField.kitchensink";
import { FileUploadKitchensink } from "./FileUpload/FileUpload.kitchensink";
import { MonthFieldKitchensink } from "./MonthField/MonthField.kitchensink";
import { MotionRegionKitchensink } from "./MotionRegion/MotionRegion.kitchensink";
import { NoticeKitchensink } from "./Notice/Notice.kitchensink";
import { PicklistKitchensink } from "./Picklist/Picklist.kitchensink";
import { RangeFieldKitchensink } from "./RangeField/RangeField.kitchensink";
import { RangeGroupKitchensink } from "./RangeGroup/RangeGroup.kitchensink";
import { RangeScaleKitchensink } from "./RangeScale/RangeScale.kitchensink";
import { ScrollAreaKitchensink } from "./ScrollArea/ScrollArea.kitchensink";
import { ThemeSwitchKitchensink } from "./ThemeSwitch/ThemeSwitch.kitchensink";
import { TimeFieldKitchensink } from "./TimeField/TimeField.kitchensink";
import { ToggleTipKitchensink } from "./ToggleTip/ToggleTip.kitchensink";
import { WeekFieldKitchensink } from "./WeekField/WeekField.kitchensink";

export function AggregateKitchensink() {
  return (
    <KitchensinkPage
      title="Kitchen sink"
      intro="Conformance target for the reference-components e2e suite, rendered under the Cursor design system. Components appear here as they are ported."
    >
      <AffixFieldKitchensink />
      <ChoiceFieldKitchensink />
      <ChoiceGroupKitchensink />
      <DateFieldKitchensink />
      <DateTimeFieldKitchensink />
      <FileUploadKitchensink />
      <MonthFieldKitchensink />
      <MotionRegionKitchensink />
      <NoticeKitchensink />
      <PicklistKitchensink />
      <RangeFieldKitchensink />
      <RangeGroupKitchensink />
      <RangeScaleKitchensink />
      {/* ScrollArea sets `margin-inline: calc(var(--_sc-offset) * -1)` and
          deliberately breaks out of its container, so it needs a full-width
          `min-w-0` context or the negative margin fights the page grid. */}
      <div className="w-full min-w-0">
        <ScrollAreaKitchensink />
      </div>
      {/* ThemeSwitch projects `data-appearance` onto <html>, so exactly ONE
          instance on this page may carry `data-component="ThemeSwitch"` — its
          contract says so, and two live instances would fight for the root
          attribute. The kitchensink's state rows are inert copies. */}
      <ThemeSwitchKitchensink />
      <TimeFieldKitchensink />
      <ToggleTipKitchensink />
      <WeekFieldKitchensink />
    </KitchensinkPage>
  );
}

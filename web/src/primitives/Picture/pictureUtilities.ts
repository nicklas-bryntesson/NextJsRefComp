/* pictureUtilities.ts — STEP 3. The design values from Media.css, as Tailwind
 * utilities on the same DOM, with every structural class name kept.
 *
 * Media.css after step 2 was three rules and eleven declarations, so the
 * translation itself is almost nothing. What makes step 3 interesting for this
 * component is that BOTH surviving rules are contingent on a class name the
 * CALLER chooses, and a utility cannot be contingent on anything.
 *
 * ── THE CONTINGENCY, which is this component's whole step-3 finding ─────────
 *
 * `BuildFigureHtml` parameterises `figureClass` (default `"Media"`) and
 * `pictureClass` (default `"Media-picture"`), and its two upstream callers pass
 * different values — `PictureTagHelper` takes the defaults, `TeaserTagHelper`
 * passes `"MediaContainer"` / `"Media"`. Step 2's selectors therefore *select*:
 *
 *     :where(figure.Media)   { … card treatment … }
 *     :where(.Media-picture) { display: block; & img { … } }
 *
 * A Teaser's figure is `.MediaContainer`, so it gets no card treatment; a
 * Teaser's picture is `.Media`, so it gets no `display: block` and its img gets
 * no sizing. That is not an accident of the stylesheet, it is the mechanism by
 * which one builder serves two visual contracts — the consuming component
 * (Teaser.css) supplies its own.
 *
 * A utility class on an element is unconditional by construction. Emitting
 * `rounded-lg border border-hairline` on the figure would give a Teaser a card
 * border the stylesheet deliberately withheld. So the selector's contingency has
 * to be re-expressed as a JavaScript decision before render — which is the
 * Button port's "resolve it in JS, never emit both" lesson arriving by a
 * different route. There the conflict was two utilities at equal specificity;
 * here there is no conflict at all, only a condition that CSS could state and
 * the utility layer cannot.
 *
 * ── WHAT THAT COSTS ────────────────────────────────────────────────────────
 *
 * Under CSS the switch was open: ANY caller could pass a third class name and
 * get a documented, predictable answer (no card treatment, because the selector
 * did not match). After step 3 the switch is a pair of string equality tests
 * against the two names this file knows about, so a third caller silently gets
 * the Teaser branch. The stylesheet was extensible by construction; the
 * component is extensible only by editing it.
 *
 * ── WHAT IS LEFT IN Media.css ──────────────────────────────────────────────
 *
 * Nothing. Every declaration moved, and the file is comments only — the same
 * outcome the Card port reported. It is kept, and still imported, because
 * deleting it would delete the record of what the source's stylesheet actually
 * said, and because the import is what makes the component deletable in one
 * move.
 */

/** Space-join, dropping absent parts. Same helper shape as the Button port's
 *  `cx`, kept local so the two primitive families stay independent. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}

/** The default figure class the source uses, and therefore the one the card
 *  treatment is contingent on. */
export const DEFAULT_FIGURE_CLASS = "Media";
/** The default picture class, and therefore the one the img sizing is contingent
 *  on. */
export const DEFAULT_PICTURE_CLASS = "Media-picture";

/* `:where(figure.Media)` — cursor-DESIGN.md's ide-mockup-card / ide-pane.
 * `border` is Tailwind's 1px, matching `border: 1px solid`. No shadow utility,
 * because the design doc's rule is "hairline-only depth; no drop shadows" and
 * the absence is the design decision. */
export const FIGURE_CARD = "m-0 overflow-hidden rounded-lg border border-hairline bg-canvas-soft";

/* `:where(figure.Media) { margin: 0 }` in isolation. A figure has a UA margin of
 * 1em 40px, so the reset is required on EVERY figure this builder emits,
 * including the Teaser one — it is the only declaration in the original rule
 * that was never really contingent, and the `figure` qualifier in step 2's
 * selector made it so by accident. Splitting it out preserves step 2's computed
 * values exactly; see the note in the header about what the snapshot caught. */
export const FIGURE_RESET = "m-0";

/* `:where(.Media-picture) { display: block }` — a <picture> is `display: inline`
 * by default, which is what the step-1 measurement observed on the Teaser path. */
export const PICTURE_BLOCK = "block";

/* `:where(.Media-picture) img`. `h-full` rather than `h-auto`: the stylesheet
 * says `height: 100%`, which resolves to `auto` against an indefinite parent but
 * fills a definite one — the behaviour Teaser's flow-horizontal state depends on.
 * Keeping `h-full` keeps that, and the computed-style diff is what proves the
 * two are not interchangeable. */
export const IMG_FILL = "block h-full w-full object-cover";

/** The figure's utilities. The card treatment is contingent on the caller having
 *  taken the default class name; the margin reset never is. */
export function figureUtilities(figureClass: string): string {
  return figureClass === DEFAULT_FIGURE_CLASS ? FIGURE_CARD : FIGURE_RESET;
}

/** The picture's utilities, and whether its img gets the sizing rules. Both are
 *  contingent on the same name, because in the stylesheet both live in the same
 *  `:where(.Media-picture)` block. */
export function pictureUtilities(pictureClass: string): { picture: string; img: string } {
  return pictureClass === DEFAULT_PICTURE_CLASS
    ? { picture: PICTURE_BLOCK, img: IMG_FILL }
    : { picture: "", img: "" };
}

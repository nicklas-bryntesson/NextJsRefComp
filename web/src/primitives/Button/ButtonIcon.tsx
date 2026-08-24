/* ButtonIcon.tsx — the JSX half of `ButtonHelper.cs`.
 *
 * `ButtonHelper.RenderIcon` builds a raw HTML string and HTML-encodes the icon
 * name into a sprite fragment reference:
 *
 *   <svg class="Button-icon" aria-hidden="true" focusable="false">
 *     <use href="#{encoded}" />
 *   </svg>
 *
 * In React the encoding is the renderer's job, so the whole `HtmlEncoder` call
 * disappears — that is one of the few places the port is strictly smaller than
 * the source. `focusable="false"` is retained: it is an SVG 1.1 attribute IE/old
 * Edge needed to keep the <svg> out of the tab order, harmless elsewhere, and
 * dropping it would be a silent behaviour change rather than a cleanup.
 */

export function ButtonIcon({ icon }: { icon: string }) {
  return (
    <svg className="Button-icon" aria-hidden="true" focusable="false">
      <use href={`#${icon}`} />
    </svg>
  );
}

/** `CtaButtonHelper` emits the same element under the CtaButton lexicon. */
export function CtaButtonIcon({ icon }: { icon: string }) {
  return (
    <svg className="CtaButton-icon" aria-hidden="true" focusable="false">
      <use href={`#${icon}`} />
    </svg>
  );
}

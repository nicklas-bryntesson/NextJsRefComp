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

export function ButtonIcon({ icon, className }: { icon: string; className?: string }) {
  return (
    /* STEP 3: `Button-icon` stays first — it is the part identity and the only
       handle a consumer has. The size/layout utilities arrive from the caller,
       because the icon's height and its compensating negative margin depend on
       the BUTTON's size, which this component does not know. In step 2 the
       stylesheet read `--_iconSize` off the ancestor and needed no such
       plumbing: inheritance did it. That is a small but exact illustration of
       what the utility layer cannot do — a utility has no access to the
       cascade. */
    <svg className={`Button-icon${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <use href={`#${icon}`} />
    </svg>
  );
}

/** `CtaButtonHelper` emits the same element under the CtaButton lexicon. */
export function CtaButtonIcon({ icon, className }: { icon: string; className?: string }) {
  return (
    <svg className={`CtaButton-icon${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <use href={`#${icon}`} />
    </svg>
  );
}

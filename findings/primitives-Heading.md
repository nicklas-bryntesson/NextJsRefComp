# findings/primitives-Heading.md

`TagHelpers/HeadingTagHelper.cs` (`app-heading`, 8.7 KB — the largest file in the
Razor set) ported to `web/src/primitives/Heading/` in three ordered commits:
`fbb1026` (step 1, verbatim), `9ab41e0` (step 2, restyle), plus the step-3
commit below.

Route: `/primitives/heading`. Probes: `web/tasks/probes/typo-computed.cjs`,
`typo-axe.cjs`, `typo-reflow.cjs`, `typo-text-spacing.cjs`,
`typo-family-collapse.cjs`. Snapshots: `web/tasks/snapshots/heading-step1.json`,
`heading-step2-before-tailwind.json`.

Prose is the sibling port; its findings are in `findings/primitives-Prose.md`
and the two share the family-collapse and nine-steps entries below.

---

### F-NEW · The four-to-two family collapse costs stroke weight and nothing else — measured, and it moves in the direction the design doc asks for

**Surface:** `primitive-tokens.css`'s type-family block vs the source's
`ClientApp/scss/tokens/typography/typography.{constant,semantic}.scss`.
Probe: `tasks/probes/typo-family-collapse.cjs`, which loads the four real faces
(Abril Fatface, Fira Sans, Noto Serif, Inter) from Google Fonts and renders the
same specimen twice at the source's own sizes and at ours.

The bridge calls this collapse "the largest visual change in the port". That was
an assertion; here is the measurement.

**First result — the four faces are nearly interchangeable in PROPORTION.**
Cap height and x-height as a fraction of em, from the glyph bounding box:

| role | source face | cap/em | x-h/em | → | ours | cap/em | x-h/em |
|---|---|---|---|---|---|---|---|
| display | Abril Fatface | 0.70 | **0.48** | | Inter | 0.73 | 0.55 |
| heading | Fira Sans | 0.69 | 0.53 | | Inter | 0.73 | 0.55 |
| body | Noto Serif | 0.71 | 0.54 | | Inter | 0.73 | 0.55 |

Every source face sits within 0.04 em of Inter's cap height. A substitution that
preserves cap height preserves the vertical rhythm, the line-box maths and the
optical size — which is why step 1 already "read as ours" and why nothing in
either stylesheet needed a metric adjustment.

**Second result — the one thing it does cost is ink.** Rasterised at a
normalised 100 px cap height and measured as non-background coverage of the
glyph bounding box:

| role | source | ours | Δ ink | Δ advance at equal cap |
|---|---|---|---|---|
| **display** | Abril Fatface **33.7 %** | Inter 400 **25.7 %** | **−24 %** | +1 % |
| heading | Fira Sans 600 34.9 % | Inter 600 32.8 % | −6 % | +2 % |
| body | Noto Serif 24.0 % | Inter 400 25.7 % | +7 % | −2 % |

Read the display row against the advance column: the two faces occupy the *same
horizontal room* at the same cap height (758 px vs 769 px for "Handgloves") and
differ by a quarter of their ink. Abril Fatface's low x-height (0.48 against a
0.70 cap) is the didone signature — small lowercase, tall caps, heavy stems — and
it is precisely what the −24 % measures.

**So the collapse is not a loss against the design doc. It is the design doc.**
`cursor-DESIGN.md` asks for display that "sits at weight 400 with negative
letter-spacing — a magazine-editorial voice rather than tech-bombastic", and
names "never bold" as a principle. A 24 % reduction in display ink at unchanged
proportion and unchanged advance is a mechanically exact description of moving
from bombastic to editorial. The one substitution the bridge flagged as its
biggest risk is the one that best serves the target design.

**Decision:** the collapse stands, and the ✕ comment in `primitive-tokens.css`
understates its own case. The honest framing is not "four families become two and
we lose three voices" but "three of the four faces were metrically
interchangeable with Inter, and the fourth differed in exactly the axis the
design system wanted moved".

**Where the "magazine voice" actually fails is the SIZE map, not the family** —
see the next entry. Measured at the same time, from the same probe:

| step | source (desktop) | ours | Δ size | Δ cap height in px |
|---|---|---|---|---|
| display-1 | 64 px | 72 px | **+13 %** | +17 % |
| display-2 | 56 px | 36 px | **−36 %** | −33 % |
| display-3 | 48 px | 26 px | **−46 %** | −44 % |
| heading-1 | 56 px | 36 px | −36 % | −32 % |
| heading-6 | 18 px | 11 px | −39 % | −36 % |
| body-lg | 28 px | 16 px | −43 % | −42 % |

**Open question for the design system.** `display-1` is the only step that grew,
and it is the only one where the editorial voice is achievable as specified — 72
px at 400 with −2.16 px tracking is a magazine cover. `display-2` at 36 px and
`display-3` at 26 px are section heads; at that size, weight 400 plus negative
tracking is not a voice, it is just a normal-weight subhead. The doc's own
`{typography.display-lg}` row (36 px / 400 / −0.72 px) is described as "Section
heads", which is consistent — the doc simply has no second and third *display*
step, and the bridge has to borrow the section-head stops for them.

---

### F-NEW · Nine steps onto six is lossy in PRACTICE, and the loss is a cliff rather than a collision

**Surface:** the `--fontSize-*` block in `primitive-tokens.css`, measured on the
step-2 build at 1280 px.

The paper claim is "nine heading steps onto our four display + two title". That
undersells how little is lost by collision and oversells how little is lost
overall. Measured, distinct rendered sizes:

| | source, desktop | ours |
|---|---|---|
| display-1 / 2 / 3 | 64 / 56 / 48 | 72 / 36 / 26 |
| h1 … h6 | 56 / 40 / 32 / 24 / 20 / 18 | 36 / 26 / 22 / 18 / 16 / 11 |
| **distinct values** | **8 of 9** | **7 of 9** |
| collisions | display-2 = h1 (56) | display-2 = h1 (36), display-3 = h2 (26) |

So nine steps onto six roles produces **seven** distinct sizes, not six, and adds
exactly **one** collision to the one the source already had. On paper that is
nearly free.

**Three things make it expensive in practice.**

**1. The display ramp becomes a cliff.** Step ratios between adjacent display
sizes: source 64→56→48 is ×1.14 and ×1.17 — a smooth ramp. Ours 72→36→26 is
**×2.00** and ×1.38. `display-1` is exactly double `display-2`. There is no
intermediate step, so a page that needs "smaller than the hero but still
display" has nothing to reach for, and `data-size="2"` on a display heading now
lands in the middle of the heading ramp rather than near the top of the display
one.

**2. h6 inverts the hierarchy.** `--fontSize-h6` maps to
`--text-caption-uppercase` = **11 px**, and body text is 16 px. Measured in the
Prose long-form sample: `h6` renders at 11 px / 600 while the paragraph beneath
it renders at 16 px / 400. **The sixth heading level is smaller than the text it
introduces.** That is not a taste question — a heading that is 69 % of the size
of its own body copy reads as a label, and the source's h6 (18 px against 20 px
body, 90 %) did not.

**3. Two of the six steps are size-identical and separable only by weight.**
`h5` = `--text-title-sm` = 16 px and body = `--text-body-md` = 16 px. Measured:
h5 renders 16 px / 600, body 16 px / 400. Whether that reads as a heading depends
entirely on the weight surviving, which is exactly the kind of single-signal
hierarchy the collapse creates.

**Decision:** left as the bridge maps it, in both `Heading.css` and `Prose.css`,
because the fix is a seventh type stop in `design-tokens.css` and that file is
not this port's to change. Recorded as the concrete cost.

**What I deliberately did NOT do, and why it matters:** `h6` landing on the
caption-uppercase role tempts you to apply the *whole* role — `text-transform:
uppercase` and its +0.08 em tracking — which would make 11 px read correctly as a
section label. Measured what that gives (0.88 px tracking at 11 px) and rejected
it in both stylesheets, setting `letter-spacing: normal` instead. Taking a
role's *size* is mapping; taking its *treatment* is inventing a step the source
does not have, and it would silently turn `<h6>` from a heading into a label for
every consumer. **Recommendation:** add one 13–14 px title stop and point
`--fontSize-h6` at it.

---

### F-NEW · `--baseline-offset-*` was never doing any work — the source's own calc is invalid, in both branches and with either token value

**Surface:** `Heading.css` lines 113–121 (verbatim), the source's
`typography.semantic.scss`, and a four-way `calc()` test in Chromium 141.

`primitive-tokens.css` neutralises `--baseline-offset-*` at 1 and justifies it
with ADR-0025 — "a value that only makes things look different is taste, not
mechanics". **The real reason is stronger and different: the mechanism never
ran.** Grepped the source for every consumer before concluding it, as asked:

```
ClientApp/scss/tokens/typography/typography.semantic.scss:7,14,22,32   the four definitions
ClientApp/css/04_ui/Heading.css:37,54,68                               --_baselineOffset: var(--baseline-offset-*)
ClientApp/css/04_ui/Heading.css:118,119                                the only two READS
ClientApp/css/04_ui/Button.css:7,307,310,311                           the same pattern, own token
```

Two consumers, both inside `Heading.css`'s `@supports not (...)` fallback:

```css
--_marginBlockStart: calc(var(--_marginBlock) + var(--_baselineOffset, 0));
--_marginBlockEnd:   calc(var(--_marginBlock) - var(--_baselineOffset, 0));
```

And the source defines the token as a **unitless `1`** — `--baseline-offset-heading: 1;
/* for lineheight calcs (faux text trim) */`. A length plus a bare number is not
a valid `calc()`. Measured directly, four combinations:

| declaration | `--off` | computed `margin-block-start` |
|---|---|---|
| `calc(var(--m) + var(--off, 0))` | `1` | **`0px`** ✕ |
| `calc(var(--m) * var(--off, 0))` | `1` | `-4px` ✓ |
| `calc(var(--m) + var(--off, 0))` | *undefined* | **`0px`** ✕ |
| `calc(var(--m) + 0px)` | `1` | `-4px` ✓ |

`CSS.supports('margin-block-start', 'calc(-4px + 1)')` → `false`. So the
declaration is invalid at computed-value time and resolves to the initial `0`,
which means the entire faux-trim fallback **zeroed itself** — and note row 3: it
does so even when the token is absent, because the numeric `var()` fallback `0`
is unitless too. There is no value of `--baseline-offset-*` that makes this work.

Second, independent reason it is dead: **the fallback branch is not taken at
all.** Measured on the route, `CSS.supports('text-box-trim','trim-both')` and
`CSS.supports('text-box-edge','cap alphabetic')` are both `true` in Chromium 141,
so the native branch wins and the fallback is unreachable in any current
Chromium.

**Decision:** step 2 removes the `--_baselineOffset` term from the fallback maths
entirely, leaving `margin-block: var(--_marginBlock)`. That is the only change
that makes the branch do what its own comment says it does. Neutralising the
token at 1 in the bridge was correct by accident: it reproduces the source's
behaviour exactly, because the source's behaviour was "no offset".

**Open question for upstream.** Either write `* var(--_baselineOffset)` (the
multiplier the comment implies), or give the token a unit and keep `+`, or delete
the token. It currently ships in four semantic tokens, three component
declarations and two reads, and does nothing — and `Button.css` lines 307–311
have the same shape with its own `--button--baselineOffset`, so the defect is
duplicated.

---

### F-NEW · The type size was on the wrong element, and it silently defeated the design system's own display tracking

**Surface:** `Heading.css`'s `.heading-link, .heading-text` block vs
`HeadingTagHelper.ProcessAsync`'s two content branches. Measured on the step-1
build. **The headline Heading finding.**

Upstream, `font-size` and `line-height` are declared ONLY on
`.heading-link` / `.heading-text` — the wrapper the TagHelper emits only in
`text` mode. The `data-size` gate fills `--_fontSize` on the root; the child
reads it. Two consequences, and the second is much worse than the first.

**1. Child content is never sized.** Measured, `variant="display" size="1"`:

| content mode | `.Heading` font-size | inner font-size |
|---|---|---|
| `text="Sized"` | 16 px | **72 px** |
| `children` | 16 px | *(no inner element)* |

The attribute said display-1; the type rendered at the inherited 16 px. Both
branches are first-class in the source API — `output.Content.SetHtmlContent(childContent)`
returns early before any wrapper is built — so half the component's content API
had no typography at all.

**2. `letter-spacing` is declared in `em` on the root, and the root is 16 px.**
This is the expensive one, because it is invisible. Measured step 1 vs
`cursor-DESIGN.md`'s typography table:

| step | specified | step 1 measured | fraction delivered |
|---|---|---|---|
| display-1 (72 px) | **−2.16 px** | −0.48 px | **22 %** |
| display-2 (36 px) | −0.72 px | −0.48 px | 67 % |
| heading-1 (36 px) | −0.72 px | −0.20 px | 28 % |

`−0.03em × 16px = −0.48px`, at every display size. "Negative letter-spacing on
display only" is one of the design doc's three typographic principles and the
component's own DOM structure diluted it by up to 4.5×. Nothing errors; the
tracking is simply almost absent, and at 72 px the difference between −0.48 px
and −2.16 px is the difference between "a big heading" and "a magazine cover".

**Decision:** step 2 declares `font-size` and `line-height` on `.Heading` itself.
Both defects close with two lines, and the `text`-mode rendering is unchanged
because the child re-declares the same absolute `rem` value (verified: root and
inner both 72 px, and the step-2 snapshot shows no other property moved). Step 2
also sets per-step `letter-spacing` from each `--text-*--letter-spacing`
companion token, so the six heading steps get the four different tracking values
their four target roles specify instead of one.

**Generalisable point.** A component that puts its type size on a child element
it does not always render has a *conditional* typography contract, and any `em`
unit on the parent silently measures against the wrong font-size. Both halves
were invisible to every kind of test the source has: the markup is correct, the
attributes are correct, the CSS is valid, and nothing is missing — the numbers
are just quietly wrong. Only a computed-style probe finds it.

---

### F-NEW · Three validated axes that matched no CSS rule at all

**Surface:** `HeadingTagHelper`'s `ValidColors` / `ValidWraps` vs `Heading.css`.
Measured on the step-1 build.

The helper spends most of its 8.7 KB validating. Three of those validations
produced attributes the stylesheet had no selector for:

| axis | values validated | rules in the source CSS |
|---|---|---|
| `data-color` | `primary`, `dark`, `light`, `inherit` | **none** — `--_color: ;` is declared and never read |
| `data-wrap="nowrap"` | 1 of 4 | **none** (the other three have rules) |
| `data-align` | all 3 | 3 ✓ |

Measured `color` for all four `data-color` values on the step-1 build:
`rgb(38, 37, 30)`, `rgb(38, 37, 30)`, `rgb(38, 37, 30)`, `rgb(38, 37, 30)`.
Identical. A CMS editor picking "light" for a heading on a dark band got ink.

This is the same shape as the Button port's `data-intent="neutral"` finding, with
one important difference: `neutral` matching no rule is *correct*, because
neutral **is** the base appearance. Here there is no such reading —
`--_color: ;` is a declared-and-unused blank property, which is the source's own
idiom for "a gate fills this", and no gate was ever written.

**Decision:** filled in during step 2 with our tokens, keeping the blank-property
seam:

```css
&[data-color] { color: var(--_color); }
&[data-color="primary"] { --_color: var(--color-primary); }
&[data-color="dark"]    { --_color: var(--color-ink); }
&[data-color="light"]   { --_color: var(--color-on-primary); }
&[data-color="inherit"] { --_color: inherit; }
```

**The `&[data-color]` scoping is load-bearing and worth its own sentence.** The
obvious form — `color: var(--_color)` unscoped on `.Heading`, matching how
`Button.css` reads its blank properties — is a real regression here. With
`--_color` empty, `color: var(--_color)` is invalid at computed-value time, which
resolves to `unset`, which for an inherited property means `inherit`. That would
have demoted every `h1`–`h4` from the `--color-ink` that `globals.css`'s base
layer gives them down to the inherited `--color-body`, on every heading with no
`data-color`. The blank-property idiom is only safe when *something* always fills
the property; when the attribute is optional, the read has to be scoped to the
attribute.

`data-wrap="nowrap"` was completed with `text-wrap: nowrap` — the only CSS that
means what the attribute name says. Recorded with a warning: it is a **WCAG
1.4.10 hazard by construction**, since an unbreakable heading cannot reflow. The
kitchensink demonstrates it with a deliberately short string; a long one puts
real horizontal scroll on the document at 320 px.

**Open question for upstream:** `data-color` should either get rules or stop
being validated and emitted. Shipping a validated four-value API that has no
effect is worse than not having it, because a consumer will use it and believe it
worked.

---

### F-NEW · `overflow-wrap: break-word` cannot shrink a container, and `min-width: 0` does not fix a grid track

**Surface:** `Heading.css`'s reset, found by `typo-text-spacing.cjs` at 320 px
rather than by the plain reflow sweep.

`.Heading`'s reset is `word-wrap: break-word; overflow-wrap: break-word`. Under
the WCAG 1.4.12 overrides at a 320 px viewport, the "nine steps" demo — single
unbroken tokens like `display-1` at 72 px with `letter-spacing: 0.12em` forced —
produced **61 px of document horizontal scroll**, with `.heading-text` reaching a
381 px right edge.

The reason is a CSS distinction worth knowing: **`overflow-wrap: break-word`
permits a break to avoid overflow but does not reduce the element's min-content
contribution. Only `overflow-wrap: anywhere` does both.** So in an
intrinsically-sized track the unbroken word still sizes the track, and then the
break-word rule has nothing left to save.

Measured ancestor chain at the failure:

| element | box width | `min-width` | `grid-template-columns` |
|---|---|---|---|
| `span.heading-text` | 340 px | 0 | — |
| `p.Heading` | 340 px | auto | — |
| my `div.grid.min-w-0` | **238 px** | 0 | **340.281 px** |
| `Cell` inner grid | 238 px | auto | 238 px |

The wrapper's **box** was correctly 238 px while its own **track** computed to
340.281 px. `min-width: 0` constrains the box; it does not constrain the track of
a grid that is itself a grid item. Fixed with `grid-cols-[minmax(0,1fr)]`, after
which the route is 0 px at every width from 320 to 1280 and survives 1.4.12.

**Decision:** fixed in the kitchensink, not in `Heading.css`. Changing the reset
to `anywhere` would make every heading break mid-word in normal use, which is a
worse trade than requiring the container to be shrinkable — and containers are
the consumer's, not the component's.

**Positive finding, and a generalisable rule.** The shared `Cell` chrome was
found to have the identical defect independently and at the same time, and fixed
the same way. Two ports reaching `min-w-0` and finding it insufficient makes this
a rule rather than an anecdote: **a grid that is also a grid item needs
`grid-cols-[minmax(0,1fr)]`, not `min-w-0`.** F-024 recorded `min-w-0` as the
answer; this supersedes it for the nested-grid case.

---

### F-NEW · The port is strictly safer than the source at exactly one point: the highlighter

**Surface:** `HeadingTagHelper.ApplyHighlight` vs
`headingAttributes.ts::splitHighlight` + `Heading.tsx::HighlightedText`.

The source builds an HTML string, hand-encoding each fragment:

```csharp
if (regex.IsMatch(part)) { result.Append("<mark>");
  result.Append(HtmlEncoder.Default.Encode(part)); result.Append("</mark>"); }
```

Then `output.Content.SetHtmlContent(wrapper)` — with `Href` interpolated into
`href="{Href}"` **unencoded**, which is a separate matter for upstream.

Two things the React port gets for free and one it corrects:

1. **Encoding is structural, not manual.** React escapes text children, so there
   is no code path where a forgotten `Encode` call becomes an injection. The
   source is correct today by discipline at three separate call sites.
2. **`href` is an attribute, not string interpolation.** `<a href={href}>` cannot
   break out of the attribute.
3. **The fragment test is exact rather than a substring match.** The source asks
   `regex.IsMatch(part)` of every fragment, which is a *substring* test — a
   non-matching fragment that merely contains a term would also be marked. The
   port identifies captures **positionally** (`String.prototype.split` with one
   capture group yields captures at odd indices), which is what the code means.

**Decision:** the splitter returns `{ text, marked }[]` — pure and unit-tested —
and the component maps it to `<mark>` / `Fragment`. Non-marked fragments are bare
text nodes, not `<span>`s, so the DOM the computed-style probe walks matches the
source's exactly. Step 2 also gives `<mark>` a brand-tinted appearance-aware
background, because the UA default (black on yellow) is neither ours nor
appearance-aware; verified at 0 axe violations in both appearances.

**Positive finding.** "Port the logic, not the class" (CLAUDE.md non-negotiable
5) paid a security dividend here rather than costing anything. The Razor helper's
string-building is the *only* way to do this in a TagHelper; JSX makes the safe
version also the shorter version.

---

### F-NEW · One dead guard branch, and two validation philosophies in one primitive set

**Surface:** `HeadingTagHelper`'s guard order, and `ProseTagHelper` for contrast.

`app-heading` checks three guards in order: (1) no text and no children →
suppress; (2) invalid combination → dev error; (3) variant/element mismatch →
dev error. Guard 2's third clause is `hasHref && !hasText`, which **guard 1
already caught** whenever there are also no children — and `href` with children
is caught by the second clause. So the clause is reachable only if
`hasHref && !hasText && hasChildContent`, which the preceding
`hasHref && hasChildContent` clause already matched. Reproduced verbatim, and the
kitchensink documents the cell as a dead branch rather than pretending it errors.

Worth recording alongside it: **the two components in this pair disagree about
what invalid input means.**

| | unknown element | unknown variant | unknown size |
|---|---|---|---|
| `app-heading` | silently → `h2` | silently → `heading` | silently → variant default |
| `app-prose` | silently → `div` | **dev error** | **dev error** |

Three philosophies across two files. `Heading`'s silent substitution is the more
dangerous default for a CMS-fed component — an editor typing `size="7"` gets
`size="2"` and no signal — but it is also the one that never breaks a page.
Reproduced exactly in both, since changing either would change the API.

**Open question for upstream:** pick one. If silent substitution is right, Prose
should not error; if erroring is right, Heading should not silently rewrite nine
of its own validated inputs.

---

### F-NEW · The token seam DOES survive a Tailwind conversion — `text-(length:--var)` is the thing the Button port did not know existed

**Surface:** `headingUtilities.ts`, step 3. **Directly qualifies F-062 and the
Button port's "the utility layer cannot hold a relationship" entry.**

`buttonUtilities.ts` hardcoded values — `-my-[0.5rem]`, `px-[1.125rem]`,
`bg-primary` — on the reasonable premise that a utility carries a value, not a
reference. Tailwind v4 has a form that carries the reference:

```
text-(length:--fontSize-h1)  leading-(--lineHeight-heading)
tracking-(--text-display-lg--letter-spacing)
font-(family-name:--fontFamily-heading)  font-(--fontWeight-heading)
[font-feature-settings:var(--fontFeatureSettings-heading)]
```

Verified on a throwaway route before converting anything — measured
**36 px / 45 px / −0.72 px / 600 / Inter / normal**, identical to step 2's
`heading` / size 1. Every one of those six utilities still reads a token from
`primitive-tokens.css`.

**So the correction to F-062 is precise: the blank-property GATE does not survive
a utility conversion, but the TOKEN INDIRECTION does.** Those are two different
things and the Button findings conflated them. What moved from CSS into JS is the
*gate* — the `&[data-size="1"]` selector that chose which token to read. What
stayed is the token read itself. For a design system that is the important half:
a consumer who redefines `--fontSize-h1` still moves this component, after the
conversion, with no rebuild.

**What it costs is readability, and that cost is real.** `text-(length:--fontSize-h1)`
is not a Tailwind utility anyone recognises at a glance, and the class attribute
on a converted `.Heading` is 240–300 characters of it. The Button findings floated
this middle path — "keep the blank custom properties and use utilities only to
fill them" — and rejected it for producing "bracket syntax for every declaration
and no readable utilities at all". Having now built it: **that judgement is right
about the syntax and wrong about the conclusion.** The syntax is ugly; the
alternative is hardcoding a design system's values into a component's JavaScript,
which is worse.

**Decision:** every design value in `Heading.css` moved to a utility that reads
the same token it read before. Computed-style diff: **0 property diffs across 109
elements × 2 appearances × 40 properties**, both routes.

---

### F-NEW · The design system's composite `text-*` utilities are role-shaped, and the source's variant × size matrix crosses roles

**Surface:** step 3, why `text-display-lg` could not be used.

`design-tokens.css` defines `--text-display-lg` plus its `--line-height`,
`--letter-spacing` and `--font-weight` companions, so Tailwind's `text-display-lg`
is one class that sets four properties. That is the clean, readable conversion —
one utility per step — and it is unusable here.

The reason is structural rather than incidental. `Heading.css`'s `[data-variant]`
layer owns line-height (`--lineHeight-heading` = **1.25** for all six heading
sizes) and its `[data-size]` layer owns font-size. But the six heading sizes land
on **four different design roles**, which specify four different line-heights:

| step | size token | role's line-height | `heading` variant needs |
|---|---|---|---|
| heading/1 | `--text-display-lg` | 1.2 → 43.2 px | **1.25 → 45 px** |
| heading/2 | `--text-display-md` | 1.25 → 32.5 px | 1.25 → 32.5 px ✓ |
| heading/3 | `--text-display-sm` | 1.3 → 28.6 px | **1.25 → 27.5 px** |
| heading/4 | `--text-title-md` | 1.4 → 25.2 px | **1.25 → 22.5 px** |

Measured: `text-display-lg` gives a 43.2 px line-height where heading/1 needs
45 px. So four of six steps would be wrong, and each in a different direction.

**The general shape is worth naming.** A design system's type composites are
**role**-shaped ("this is a section head"): size, leading, tracking and weight
bundled because they travel together in that role. The source's type system is
**axis**-shaped: a variant supplies voice and leading, a size supplies the size,
and the two compose. Neither is wrong, and a composite utility is exactly the
wrong granularity to bridge them — it bundles the one property the other model
wants to vary independently. That is why every step here is spelled out as three
separate token-reading utilities.

**For the record, the conflict is line-height and not weight.** Measured on the
probe: `font-semibold` beats `text-display-lg`'s bundled `font-weight: 400` in
**both** class orders (`text-display-lg font-semibold` and
`font-semibold text-display-lg` both compute 600), because Tailwind sorts by
property group, not by authored order. So a size-plus-weight override composes
fine; it was the leading that could not.

---

### F-NEW · What stayed CSS after step 3, and it is the same two reasons Prose could not convert at all

**Surface:** `Heading.css` after step 3 — 133 lines reduced to 2 rules.

Twelve utility rows replaced the reset, the variant voice, the variant × size
metrics, the colour axis, the alignment axis, the wrap axis and `<mark>`. Two
rules could not move, and each is one of the two structural limits:

**1. A descendant selector over elements the component does not render.**

```css
.heading-link, .heading-text { & :where(a, span, strong, em, b, i) { font: inherit; … } }
```

`<a>`, `<strong>`, `<em>` inside a heading come from the consumer, so the
component never sees the element. The Tailwind-shaped alternative is an arbitrary
descendant variant (`[&_:is(a,span,strong,em,b,i)]:font-[inherit]`), which
generates `.class :is(…)` at specificity **(0,1,1)** against this rule's
(0,1,0)+(0,0,1) — the same specificity inflation that disqualified Prose's
conversion outright, showing up here as one rule instead of twenty-five.
**Heading is the small version of Prose's problem, which is why Heading converts
and Prose does not.**

**2. A gate that is a condition rather than an element.**

```css
@supports (text-box-trim: trim-both) and (text-box-edge: cap alphabetic) { … }
```

Tailwind can express `[text-box-trim:trim-both]` as an arbitrary property, but it
has **no variant for `@supports`**. A bare arbitrary property would apply the
declaration unconditionally — harmless for these two, but the gate is the entire
point of a progressive-enhancement layer, and it has no utility form at all.

**What was deleted, and why the clean diff is misleading.** The `@supports not (…)`
faux-trim fallback branch read `--_fontSize` and `--_lineHeight`, which the
conversion no longer sets, so it could not stay correct and was removed. The
computed-style diff is **0** — because the branch was unreachable in current
Chromium (`text-box-trim` is supported, measured) and computed to `0px` anyway
(the invalid `calc()`, measured four ways). So the safety net reports green on the
deletion of a whole feature layer.

**Decision / warning:** that is the honest limit of a computed-style snapshot as a
step-3 guard. It proves nothing changed *in this browser, on this page, today*.
It cannot see a removed `@supports` branch, a removed custom-property seam, or a
removed relationship — the Button port made the same observation about
`calc(--_iconSize / 2 * -1)` becoming three constants with 0 diffs. The snapshot
is necessary and it is not sufficient; the findings file is the other half.

---

### F-NEW · Step 3 turned a public class-and-attribute API into a private one, and the source's own consumer is the proof

**Surface:** `TeaserTagHelper.cs` lines 86–107 vs the converted component.
Probe: `tasks/probes/typo-teaser-markup.cjs`. **The cost of the conversion,
measured on the real consumer rather than argued.**

`TeaserTagHelper` does not compose `app-heading`. It emits its markup:

```csharp
sb.Append($"<h2 class=\"Heading\" data-variant=\"heading\" data-size=\"4\" " +
          $"data-align=\"left\" data-wrap=\"balance\">" +
          $"<span class=\"heading-text\">{encodedHeading}</span></h2>");
```

Class plus `data-*`, which is exactly what the stylesheet was designed to style
and exactly what a utility cannot reach. Injected into the live route and measured
against what `<Heading element="h4" size="4">` renders:

| property | Teaser's markup | via the component |
|---|---|---|
| `font-size` | 16 px *(inherited)* | **18 px** |
| `line-height` | 24 px *(inherited 1.5)* | **22.5 px** |
| `font-weight` | 400 *(inherited)* | **600** |
| `letter-spacing` | normal | normal ✓ |
| `color` | ink | ink ✓ *(only because `globals.css` colours h1–h4 — an h5 teaser would differ)* |
| `.heading-text` `display` | **inline** | block |

Four of six wrong, and the one that matches does so by accident of the host base
layer. **Teaser's heading renders as unstyled body text.**

The same probe measured Prose's Teaser markup, which was *not* converted:
**5 of 5 properties identical.** One table, two components, one variable.

**Decision:** step 3 is committed for Heading and measured clean, and recorded as
a **regression in consumability** rather than a neutral translation. This is
F-062's cost, made concrete: the Button port argued that a utility conversion
moves the burden onto the consumer, using the source's nine-line hero override as
the example. Here the consumer is in the same repository and the burden is total —
not "harder to override" but "produces nothing".

**Open question, and it blocks the Teaser port.** Before Teaser lands, either
(a) Teaser composes `<Heading>` instead of emitting its markup, or (b) Heading's
step 3 is reverted. (a) is clearly right for a React port and is what I would do.
What must be recorded either way: **nothing in this repo detects the breakage.**
The computed-style diff is clean, axe is clean, the unit tests pass, and the
defect lives in markup that no test on either side renders. It was found only by
reading the consumer's source and writing a probe for it — which is a method note
worth more than the finding: after a utility conversion, the thing to test is not
the component, it is everyone who wrote its markup by hand.

---

### F-NEW · Two axes had to be resolved in JS, and the count is a fifth of Button's

**Surface:** `headingUtilities.ts` + `Heading.tsx`, step 3.

The Button port's central step-3 lesson — "a utility cannot override a utility, so
any CSS that relies on specificity to override becomes a decision the component
must make before rendering" — applies here unchanged, in two places:

**1. Variant × size → 12 enumerated rows.** Step 2 had three variant blocks each
containing its size gates: 3 + 12 short selectors, composing through specificity.
Utilities cannot compose, so each of the 12 rows carries its variant's
line-height explicitly — declared 3 times in CSS, repeated 12 times in JS.

**2. Colour.** Step 2 had a variant default (`&[data-variant="heading"] { color: ink }`)
and an optional `&[data-color]` gate at **equal specificity**, resolved by source
order. Two `color` utilities on one element is the exact trap that produced
Button's size-dependent padding bug, so the choice is made in the component and
only one class is ever emitted.

**The magnitude is the finding.** Button needed nine enumerated tone rows × ~15
lines = a 326-line file, plus three separate "resolve it in JS, never emit both"
repairs, plus every state written twice for the `hover:` / `data-[test-state=hover]:`
pair. Heading needed **12 short rows and one ternary**, and
`headingUtilities.ts` is 150 lines replacing 133 lines of CSS — roughly break-even.

Why: **Button's axes multiply, Heading's do not.** Emphasis × intent is a matrix
where one cell overrides another, so `n × m` rows are unavoidable. Variant × size
is a *lookup* — no size overrides another size, no variant overrides another — so
it enumerates linearly. A `data-*`-driven component converts cheaply when its
axes are independent and expensively when they compose, and that is predictable
from the stylesheet before any work is done: **count the selectors with two
attribute qualifiers.** `Button.css` had them; `Heading.css` had none.

---

### F-NEW · `Component-part` naming stayed collision-free, and the residual stylesheet is what makes the class names still matter

**Surface:** `Heading`, `heading-text`, `heading-link` vs F-057 and the Button
port's naming entry.

The Button port found that `Component-part` naming is structurally immune to
F-057's Tailwind lexicon collisions, because every name contains a capitalised
component name. **Heading's parts break that pattern** — `heading-text` and
`heading-link` are lowercase-kebab, like the reference library's convention, not
like `Button-text`. Checked anyway: neither collides with any Tailwind utility,
and `tailwind-collisions.css` needed zero entries. `heading-` is a long enough
prefix to be safe by accident where `.grid` and `.ring` were not.

Worth adding to that entry, though: **step 3 did not make the class names
vestigial here, and that is not true of Button.** `Button.css` after step 3
retains only a debug pseudo-element block, so `.Button-text` is nearly decorative.
`Heading.css` retains two live rules that both select on `.heading-text` /
`.heading-link` — the inline-inherit rule and the `text-box-trim` layer — so those
class names are still load-bearing CSS hooks after the conversion, not just
identity. Combined with the Teaser finding, the class names are simultaneously
**more** necessary (two rules depend on them) and **less** sufficient (they no
longer carry the type) than before step 3. That combination is the most confusing
possible state for a consumer, and it is worth stating plainly rather than
discovering.

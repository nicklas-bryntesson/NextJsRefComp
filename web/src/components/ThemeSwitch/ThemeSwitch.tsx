/* ThemeSwitch — React port of
 * reference-components/src/partials/components/ThemeSwitch (ADR-0021).
 *
 * The component owns only the plumbing: reflect the stored preference, write it
 * back, project the resolved appearance onto <html>, and announce it. Every
 * decision lives in the `theme-preference` kernel, which is the SAME module the
 * root layout calls on the server — so the layout and the runtime cannot drift,
 * which is the exact failure ADR-0021 was written about.
 *
 * Division of labour with the server, and why it is not arbitrary:
 *
 *   - The ROOT LAYOUT owns the FIRST projection. It reads the cookie during
 *     render and emits `data-appearance` in the markup, so an explicit choice is
 *     already correct in the very first frame. There is no inline correction
 *     script and no flash to correct. See web/src/app/layout.tsx.
 *   - This component owns EVERY LATER projection: it flips the attribute on the
 *     live document so the current page responds without a reload, and writes the
 *     cookie so the next load is server-correct.
 *   - `defaultPreference` is read ONCE, on the server, and passed in. Reading the
 *     cookie again in the browser would be a second source of truth for the same
 *     value and the two could disagree; passing it down makes agreement
 *     structural rather than hopeful. See findings/ThemeSwitch.md.
 *
 * What it deliberately does not do:
 *
 *   - apply tokens. The attribute's only job is pinning `color-scheme`
 *     (ui-tokens.css does that in two rules). Assigning
 *     `documentElement.style.cssText`, as the implementation ADR-0021 models did,
 *     would silently destroy every other inline style on the root.
 *   - project anything for `system`. An absent attribute IS "follow the OS", so
 *     the common case costs no attribute write, no listener on the CSS side and
 *     cannot flash.
 *   - own the persistence contract. The reference uses localStorage; we use a
 *     cookie of the same name, because the server has to be able to read it
 *     (ADR-0009 / PORTING.md's preferred structure).
 *
 * Markup notes that are contract, not taste:
 *
 *   - `<legend>` first child, non-empty, visually clipped by the stylesheet.
 *   - `input + label` adjacency and `.indicator` as the LAST child of `.options`.
 *     Selection is `input:checked + label` and the indicator is reached with
 *     `input:nth-of-type(N):checked ~ .indicator`, so any wrapper element between
 *     an input and its label breaks both, silently. `<Fragment>` renders no DOM
 *     node, which is what makes the map below safe.
 *   - `defaultChecked`, never `checked`: a controlled radio group cannot move its
 *     selection and fails as an apparent native-semantics defect (F-016).
 *   - every icon is `aria-hidden focusable="false"` with explicit width/height —
 *     a viewBox-only <svg> falls back to 300x150 until CSS sizes it.
 *   - class names are structural (F-008): `.ThemeSwitch`, `.options`,
 *     `.indicator`, `.icon`, `.visually-hidden` are all selected by the suite or
 *     the verbatim stylesheet.
 */

"use client";

import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  APPEARANCE_COOKIE,
  resolveAppearance,
  resolvePreference,
  shouldProject,
  type Appearance,
  type Preference,
} from "@/kernel/theme-preference";

import "./ThemeSwitch.css";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** One year. Long enough that a returning user keeps their choice, and the only
 *  number in the persistence layer that is ours rather than the contract's. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/* ── The live OS signal as an external store ──────────────────────────────────
 * `useEffect(() => setPrefersDark(mq.matches), [])` is a lint error here
 * (react-hooks/set-state-in-effect) and a guessed initial value is a hydration
 * mismatch. The server snapshot is "nothing known yet" — false — which is the
 * only value a server can honestly report for a media query. MotionRegion.tsx is
 * the precedent. */

function hasMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function subscribePrefersDark(onChange: () => void) {
  if (!hasMatchMedia()) return () => {};
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getPrefersDark = () => (hasMatchMedia() ? window.matchMedia(DARK_QUERY).matches : false);
const getPrefersDarkServer = () => false;

const noopSubscribe = () => () => {};
const getHydrated = () => true;
const getHydratedServer = () => false;

export type ThemeSwitchEventDetail = {
  preference: Preference;
  appearance: Appearance;
};

type SegmentSpec = { value: Preference; label: string; icon: ReactNode };

/* The three icons, verbatim from the reference kitchensink. Explicit width and
   height, not just a viewBox: a viewBox-only <svg> is 300x150 until CSS lands. */
const SEGMENTS: readonly SegmentSpec[] = [
  {
    value: "system",
    label: "Follow system setting",
    icon: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
  },
  {
    value: "light",
    label: "Light",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export type ThemeSwitchProps = {
  /** The e2e anchor. Rendered as `data-id`. */
  dataId?: string;
  /** The group's only intrinsic name. Clipped, never absent. */
  legend?: string;
  /** Shared radio `name`. Must be unique per instance on a page. */
  name: string;
  /** The three input ids, in `system, light, dark` order. */
  ids: readonly [string, string, string];
  /**
   * The stored preference, resolved on the SERVER and handed down. One read, one
   * source of truth, so the checked radio in the server HTML and the one the
   * client renders cannot disagree.
   */
  defaultPreference?: Preference;
  /**
   * Whether this instance owns the page appearance. `false` renders an inert copy
   * — no `data-component`, no cookie write, no projection, no event — which is
   * what the kitchensink's state rows need. Only ONE instance per page may
   * attach; several would fight for the root attribute.
   */
  attach?: boolean;
  /** Kitchensink only: simulated pseudo-class, projected down by the stylesheet. */
  testState?: "hover" | "focus" | "active";
  disabled?: boolean;
  /** Utilities/extra classes. `.ThemeSwitch` is always applied. */
  className?: string;
};

export function ThemeSwitch({
  dataId,
  legend = "Colour theme",
  name,
  ids,
  defaultPreference = "system",
  attach = true,
  testState,
  disabled,
  className,
}: ThemeSwitchProps) {
  /* `resolvePreference` guards the prop for the same reason the kernel exists:
     a value from a cookie is untrusted input, and an unrecognised one must leave
     a radio group with something checked. */
  const initial = resolvePreference(defaultPreference);
  const [preference, setPreference] = useState<Preference>(initial);

  const hydrated = useSyncExternalStore(noopSubscribe, getHydrated, getHydratedServer);
  const prefersDark = useSyncExternalStore(
    subscribePrefersDark,
    getPrefersDark,
    getPrefersDarkServer,
  );

  const rootRef = useRef<HTMLFieldSetElement>(null);
  const router = useRouter();

  /* The resolved answer — a derivation, so the projected attribute cannot drift
     from the inputs that decide it. */
  const appearance = resolveAppearance(preference, prefersDark);

  /**
   * ANNOUNCE ONLY — no DOM writes here, and that restraint is load-bearing.
   *
   * The obvious port of the reference's `project()` is an effect keyed on the
   * resolved appearance: it covers attach, a user change and an OS flip in one
   * place. It is also WRONG, and measurably so (findings/ThemeSwitch.md):
   *
   *   - On attach it re-asserts the component's own state over whatever the
   *     document already says. For `system` that means `removeAttribute`, which
   *     STOMPS a value another writer set — including the site-level appearance
   *     suite, which writes the attribute directly and reads `color-scheme` back
   *     two frames later. Measured: the removal landed at ~395 ms, after the
   *     suite's write, and the read returned `light dark`. It failed 1 run in 3,
   *     because it is a race with hydration.
   *   - An effect keyed on `appearance` also re-runs when the OS signal flips
   *     under `system`, re-asserting the same thing all over again.
   *   - In dev, StrictMode invokes it twice, so the stomp happens twice.
   *
   * The reference cannot hit this: its projection only ever runs inside the
   * change handler. Nothing re-asserts, because there is no React state to
   * re-assert from. ADR-0021 says the contract is the DOM END-STATE, not a
   * component that continuously reconciles the DOM to itself — a control that
   * enforces is a stronger claim than the contract makes, and it is hostile to
   * every other writer, the server included.
   *
   * So: the attribute is written on USER ACTION only (see `onChange`), and this
   * effect exists purely to dispatch `theme-change`.
   *
   * It also does NOT dispatch on attach, which the reference does — and dropping
   * that is deliberate, measured, and the second half of the same lesson.
   * `ThemeSwitch.e2e.test.js:162` registers a `theme-change` listener AFTER load
   * and then clicks; the reference's attach event has long since fired, but ours
   * fires at hydration commit (~395 ms in dev), so it can land *after* the
   * listener and resolve the test's promise with the pre-click state. Measured:
   * it passed three consecutive runs and then failed a fourth. The event is also
   * redundant here: the reference needs it because its client JS is what resolves
   * the appearance in the first place, whereas ours is already in the DOM before
   * any script runs, so `document.documentElement.dataset.appearance` is the
   * honest initial read. `ThemeSwitchReadout` below does exactly that.
   *
   * An OS flip while the preference is `system` still announces, because that IS
   * a change of resolved appearance and a host's chart palette needs it.
   */
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!attach) return;
    const resolved = `${preference}|${appearance}`;
    /* First commit — including StrictMode's second invocation — records the
       state the DOM already carries and announces nothing. */
    if (announced.current === null || announced.current === resolved) {
      announced.current = resolved;
      return;
    }
    announced.current = resolved;
    rootRef.current?.dispatchEvent(
      new CustomEvent<ThemeSwitchEventDetail>("theme-change", {
        bubbles: true,
        detail: { preference, appearance },
      }),
    );
  }, [attach, preference, appearance]);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!attach) return;
    const next = resolvePreference(event.target.value);
    const nextAppearance = resolveAppearance(next, prefersDark);
    setPreference(next);

    /* The projection — the single write, on the single event that authorises it.
       `system` REMOVES the attribute rather than writing "system": absence is the
       state, and `color-scheme: light dark` already delegates to the OS. */
    const root = document.documentElement;
    if (shouldProject(next)) {
      root.setAttribute("data-appearance", nextAppearance);
    } else {
      root.removeAttribute("data-appearance");
    }

    /* Persist where the SERVER can read it. localStorage would leave the next
       load unable to render the right appearance, which is what makes the
       flash-free structure possible at all. */
    document.cookie = `${APPEARANCE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;

    /* Invalidate Next's client Router Cache. Without this, an RSC payload cached
       before the cookie changed re-renders the root layout on a later soft
       navigation and REVERTS the appearance — measured, reproducible, and the
       one way the cookie and the layout genuinely disagree. */
    router.refresh();
  }

  return (
    <fieldset
      ref={rootRef}
      className={className ? `ThemeSwitch ${className}` : "ThemeSwitch"}
      /* The attach hook. Omitted on an inert copy — that omission is the whole
         mechanism keeping the kitchensink's state rows from re-theming the page. */
      data-component={attach ? "ThemeSwitch" : undefined}
      data-id={dataId}
      data-test-state={testState}
      data-initialized={attach && hydrated ? "true" : undefined}
      disabled={disabled}
    >
      {/* FIRST child, and non-empty: three icons need a group name, and a legend
          is the one that needs no id plumbing. Clipped by the stylesheet. */}
      <legend>{legend}</legend>
      <div className="options">
        {SEGMENTS.map((segment, index) => (
          /* Fragment, not a wrapper element: `input + label` and
             `input ~ .indicator` are both sibling selectors. */
          <Fragment key={segment.value}>
            <input
              type="radio"
              id={ids[index]}
              name={name}
              value={segment.value}
              defaultChecked={segment.value === initial}
              onChange={onChange}
            />
            <label htmlFor={ids[index]}>
              <span className="visually-hidden">{segment.label}</span>
              <Icon>{segment.icon}</Icon>
            </label>
          </Fragment>
        ))}
        {/* LAST child of .options, and decorative. */}
        <span className="indicator" aria-hidden="true" />
      </div>
    </fieldset>
  );
}

/* ── The kitchensink readout ──────────────────────────────────────────────────
 * The state machine, legible without DevTools.
 *
 * The reference builds this from the `theme-change` event, because in a
 * client-resolved implementation the event is the only place the answer exists.
 * Here the answer is in the DOM — the root's `data-appearance`, server-rendered
 * before any script — so the readout reads the END-STATE instead: the attribute
 * plus the live media query, both through `useSyncExternalStore`, both with an
 * honest server snapshot. It needs no event, cannot miss one, and cannot drift
 * from what the page is actually showing. That is the same "the DOM end-state is
 * the contract" argument ADR-0009/0021 make, applied to the demo tooling.
 */

function subscribeAppearanceAttribute(onChange: () => void) {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-appearance"],
  });
  return () => observer.disconnect();
}

/* "" stands for "no attribute", so the snapshot stays a comparable primitive. */
const getAppearanceAttribute = () =>
  typeof document === "undefined" ? "" : (document.documentElement.getAttribute("data-appearance") ?? "");
const getAppearanceAttributeServer = () => "";

export function ThemeSwitchReadout({ id }: { id?: string }) {
  const attribute = useSyncExternalStore(
    subscribeAppearanceAttribute,
    getAppearanceAttribute,
    getAppearanceAttributeServer,
  );
  const prefersDark = useSyncExternalStore(
    subscribePrefersDark,
    getPrefersDark,
    getPrefersDarkServer,
  );

  /* An absent attribute IS `system` — the same rule the kernel encodes, read back
     out of the DOM rather than out of component state. */
  const preference = resolvePreference(attribute || "system");
  const appearance = resolveAppearance(preference, prefersDark);

  /* `data-readout` keys are the reference kitchensink's, so a port of its own
     demo tooling keeps working. */
  const rows: readonly [string, string, string][] = [
    ["preference", "preference", preference],
    ["appearance", "appearance", appearance],
    ["prefers-dark", "prefers-color-scheme: dark", String(prefersDark)],
    ["attribute", "<html data-appearance>", attribute || "(absent)"],
  ];

  return (
    <table id={id} className="state-table text-body-sm text-body">
      <tbody>
        {rows.map(([key, label, value]) => (
          <tr key={key}>
            <th scope="row" className="pr-lg text-left font-normal">
              {label}
            </th>
            <td data-readout={key}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ThemeSwitch;

/* ThemeSwitch kitchensink — every state and every `data-id` from the reference
 * kitchensink (`ThemeSwitch.html`).
 *
 * TEST CONTRACT in here, not naming preference:
 *
 *  - `anchorId="ThemeSwitch"` → `id="ThemeSwitch"` on the `.kitchensink-section`
 *    element itself, exactly where the reference puts it. The spec runs an
 *    unscoped `checkA11y(page, '#ThemeSwitch')` in BOTH appearances (F-018).
 *  - Exactly ONE instance carries `data-component="ThemeSwitch"` — the live demo.
 *    Every other row is an inert copy (`attach={false}`), which is what stops six
 *    switches on one page from fighting over the root attribute. The spec asserts
 *    this directly: it clicks `[data-id="state-default"] label[for="ts-sd-3"]` and
 *    requires `<html>` to stay attribute-free.
 *  - Input ids are addressed literally by the spec: `ts-system` / `ts-light` /
 *    `ts-dark` on the live demo, and `ts-sd-3` on the default state row. The rest
 *    (`ts-sh-*`, `ts-sf-*`, `ts-sa-*`, `ts-dis-*`) are the reference's and are
 *    reproduced so the page stays diffable against it.
 *  - Radio `name` is per-instance. One shared name across the six copies would
 *    make them a single 18-member group, and selecting in one row would silently
 *    deselect the live demo.
 *
 * The live demo's checked segment comes from the cookie, read HERE — on the
 * server, in the same request that produced `<html data-appearance>` — and handed
 * to the client component as `defaultPreference`. That is what makes the server
 * HTML and the first client render agree by construction rather than by luck.
 */

import { cookies } from "next/headers";

import { APPEARANCE_COOKIE, resolvePreference } from "@/kernel/theme-preference";
import { Section, Block, Cell } from "../kitchensink-ui";
import { ThemeSwitch, ThemeSwitchReadout } from "./ThemeSwitch";

export async function ThemeSwitchKitchensink() {
  const stored = (await cookies()).get(APPEARANCE_COOKIE)?.value;
  const preference = resolvePreference(stored);

  return (
    <Section id="themeswitch" title="ThemeSwitch" anchorId="ThemeSwitch">
      <p className="mb-xl max-w-[70ch] text-body-md">
        Resolves a colour-scheme preference against the OS signal and reflects the answer on{" "}
        <code>&lt;html&gt;</code> as <code>data-appearance</code>. <strong>System</strong> projects no
        attribute at all — its absence is the state, and <code>color-scheme: light dark</code> already
        delegates to the OS. Only the live demo below is attached; the state rows are inert copies, so
        they cannot re-theme the page.
      </p>

      {/* ── 1. Live demo — the only attached instance ─────────────────────── */}
      <Block title="Live demo">
        <Cell caption="attached — writes the cookie and projects">
          <ThemeSwitch
            dataId="live"
            legend="Colour theme"
            name="ts-appearance"
            ids={["ts-system", "ts-light", "ts-dark"]}
            defaultPreference={preference}
          />
        </Cell>
      </Block>

      {/* ── 2. Interaction states ──────────────────────────────────────────
          `data-test-state` sits on the ROOT; the verbatim stylesheet projects it
          down to the segments with descendant selectors that mirror the real
          pseudo-class pairs. All inert. */}
      <Block title="Interaction states">
        <Cell caption="default">
          <ThemeSwitch
            dataId="state-default"
            legend="Interaction state: default"
            name="ts-sd"
            ids={["ts-sd-1", "ts-sd-2", "ts-sd-3"]}
            attach={false}
          />
        </Cell>
        <Cell caption="hover">
          <ThemeSwitch
            dataId="state-hover"
            legend="Interaction state: hover"
            name="ts-sh"
            ids={["ts-sh-1", "ts-sh-2", "ts-sh-3"]}
            testState="hover"
            attach={false}
          />
        </Cell>
        <Cell caption="focus">
          <ThemeSwitch
            dataId="state-focus"
            legend="Interaction state: focus"
            name="ts-sf"
            ids={["ts-sf-1", "ts-sf-2", "ts-sf-3"]}
            testState="focus"
            attach={false}
          />
        </Cell>
        <Cell caption="active">
          <ThemeSwitch
            dataId="state-active"
            legend="Interaction state: active"
            name="ts-sa"
            ids={["ts-sa-1", "ts-sa-2", "ts-sa-3"]}
            testState="active"
            attach={false}
          />
        </Cell>
      </Block>

      {/* ── 3. Disabled — the <fieldset disabled> cascade ─────────────────── */}
      <Block title="Disabled">
        <Cell caption="fieldset disabled">
          <ThemeSwitch
            dataId="disabled"
            legend="Colour theme (unavailable)"
            name="ts-dis"
            ids={["ts-dis-1", "ts-dis-2", "ts-dis-3"]}
            disabled
            attach={false}
          />
        </Cell>
      </Block>

      {/* ── 4. Resolved state — the state machine, legible without DevTools ── */}
      <Block title="Resolved state">
        <ThemeSwitchReadout id="ThemeSwitch-readout" />
      </Block>
    </Section>
  );
}

export default ThemeSwitchKitchensink;

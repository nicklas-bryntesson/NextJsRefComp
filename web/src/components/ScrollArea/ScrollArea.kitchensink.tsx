/* ScrollArea kitchensink — every state the reference's ScrollArea.html shows.
 *
 * The `data-id` values are TEST CONTRACT, not naming preference:
 * `e2e-helpers/target.js` resolves the suite's root as
 * `[data-component="ScrollArea"][data-id="scrollarea-live"]`, and the reference
 * demo page also carries `scrollarea-clip-demo` for the popover-clipping
 * limitation. `scrollarea-fits` is ours, added to make the DISABLED state (content
 * fits → no bar, no tab stop) visible and probe-able; nothing selects it.
 *
 * Layout note: the ScrollArea root is `margin-inline: calc(var(--_sc-offset) * -1)`
 * — it deliberately breaks OUT of its container to the page gutter. Each instance
 * therefore sits in a full-width wrapper inside the Block rather than as a
 * flex-row sibling, so the break-out lands on the Block's padding.
 *
 * Surface note: `--_sc-fade-color` defaults to the `Canvas` system colour, which
 * under our pinned `color-scheme: light` resolves to #ffffff — exactly
 * `--color-surface-card`. So the fades match the Block's surface for free. They
 * would NOT match the page canvas (#f7f7f4). See findings/ScrollArea.md.
 */

import { ScrollArea } from "./ScrollArea";
import { Section, Block } from "../kitchensink-ui";

const cell = "border border-hairline px-sm py-xs text-left text-body-sm text-body";
const head = "border border-hairline bg-canvas px-sm py-xs text-left text-body-sm text-ink";

function MembersTable() {
  return (
    <table className="state-table m-0 border-collapse whitespace-nowrap">
      <thead>
        <tr>
          <th scope="col" className={head}>Name</th>
          <th scope="col" className={head}>Member ID</th>
          <th scope="col" className={head}>Joined</th>
          <th scope="col" className={head}>Renewed</th>
          <th scope="col" className={head}>Plan</th>
          <th scope="col" className={head}>Region</th>
          <th scope="col" className={head}>Status</th>
          <th scope="col" className={head}>Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" className={head}>Margaret Nguyen</th>
          <td className={cell}>427311</td>
          <td className={cell}><time dateTime="2010-06-03">June 3, 2010</time></td>
          <td className={cell}><time dateTime="2024-06-03">June 3, 2024</time></td>
          <td className={cell}>Professional</td>
          <td className={cell}>Nordics</td>
          <td className={cell}>Active</td>
          <td className={cell}>0.00</td>
        </tr>
        <tr>
          <th scope="row" className={head}>Edvard Galinski</th>
          <td className={cell}>533175</td>
          <td className={cell}><time dateTime="2011-01-13">January 13, 2011</time></td>
          <td className={cell}><time dateTime="2024-01-13">January 13, 2024</time></td>
          <td className={cell}>Student</td>
          <td className={cell}>Central Europe</td>
          <td className={cell}>Active</td>
          <td className={cell}>37.00</td>
        </tr>
        <tr>
          <th scope="row" className={head}>Hoshi Nakamura</th>
          <td className={cell}>601942</td>
          <td className={cell}><time dateTime="2012-07-23">July 23, 2012</time></td>
          <td className={cell}><time dateTime="2023-07-23">July 23, 2023</time></td>
          <td className={cell}>Professional</td>
          <td className={cell}>Asia Pacific</td>
          <td className={cell}>Lapsed</td>
          <td className={cell}>15.00</td>
        </tr>
      </tbody>
    </table>
  );
}

export function ScrollAreaKitchensink() {
  return (
    <Section id="scrollarea" title="ScrollArea">
      <p className="mb-xl max-w-[60ch] text-body-md">
        Wraps horizontally-overflowing content in an edge-to-edge scroller with edge
        fades and a custom horizontal scrollbar. The scroller is a focusable{" "}
        <code>role=&quot;region&quot;</code>: once it overflows, tab to it and the arrow keys
        scroll it natively. The custom bar is a pointer/visual affordance (drag the
        thumb or click the track) — it appears only on overflow and auto-hides on idle.
      </p>

      {/* ── Primary use / live demo: the conformance target ──────────────────── */}
      <Block title="Wide table — live (overflows on narrow viewports)">
        <div className="w-full min-w-0">
          <ScrollArea dataId="scrollarea-live" ariaLabel="Members table">
            <MembersTable />
          </ScrollArea>
        </div>
      </Block>

      {/* ── DISABLED state: content fits, so no bar and no tab stop ──────────── */}
      <Block title="Content fits — no overflow (not a tab stop, no bar)">
        <div className="w-full min-w-0">
          <ScrollArea dataId="scrollarea-fits" ariaLabel="Short content">
            <p className="m-0 text-body-sm text-body">This fits — nothing to scroll.</p>
          </ScrollArea>
        </div>
      </Block>

      {/* ── Gap-filled accessible name: no ariaLabel authored ────────────────── */}
      <Block title="Gap-filled name (no aria-label authored)">
        <div className="w-full min-w-0">
          <ScrollArea dataId="scrollarea-gapfill">
            <p className="m-0 whitespace-nowrap text-body-sm text-body">
              No aria-label was authored, so the component gap-fills the reference&apos;s
              default name — long enough a line that it overflows a narrow viewport and
              the region becomes focusable.
            </p>
          </ScrollArea>
        </div>
      </Block>

      {/* ── Known limitation, demonstrated on purpose ────────────────────────── */}
      <Block title="Popover clipping (a known limitation)">
        <div className="w-full min-w-0">
          <p className="mb-base max-w-[60ch] text-body-sm text-body">
            A horizontal scroller forces <code>overflow-y</code> to a non-visible value, so
            anything positioned outside the scroller&apos;s box — a tooltip bubble, a menu — is
            clipped at its edge. The bubble below is absolutely positioned above its
            anchor and is cut off by the scroller. This is inherent to scroll containers,
            which is why popover-bearing components are never wrapped in a ScrollArea.
          </p>
          <ScrollArea
            dataId="scrollarea-clip-demo"
            ariaLabel="Clipping example"
            style={{ maxInlineSize: "22rem" }}
            contentClassName="flex items-center gap-sm whitespace-nowrap py-lg"
          >
            <span className="relative inline-block" data-id="scrollarea-clip">
              <span
                aria-hidden="true"
                className="absolute bottom-full left-0 mb-xs w-max rounded-md border border-hairline-strong bg-surface-card px-sm py-xs text-body-sm text-ink"
              >
                This bubble is clipped by the scroller&apos;s overflow.
              </span>
              <span className="text-body-sm text-body">Anchor</span>
            </span>
            <span className="text-body-sm text-body">
              The bubble above is clipped by the scroll container.
            </span>
          </ScrollArea>
        </div>
      </Block>

      {/* ── Native reference ─────────────────────────────────────────────────── */}
      <Block title="Native reference — plain overflow-x scroller">
        <div className="w-full min-w-0">
          <p className="mb-base text-body-sm text-body">
            The browser&apos;s own horizontal scroller — native bar, no fades, no inset.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="state-table m-0 min-w-[40rem] border-collapse whitespace-nowrap">
              <thead>
                <tr>
                  <th scope="col" className={head}>Name</th>
                  <th scope="col" className={head}>Member ID</th>
                  <th scope="col" className={head}>Joined</th>
                  <th scope="col" className={head}>Plan</th>
                  <th scope="col" className={head}>Region</th>
                  <th scope="col" className={head}>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className={head}>Margaret Nguyen</th>
                  <td className={cell}>427311</td>
                  <td className={cell}><time dateTime="2010-06-03">June 3, 2010</time></td>
                  <td className={cell}>Professional</td>
                  <td className={cell}>Nordics</td>
                  <td className={cell}>0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Block>
    </Section>
  );
}

export default ScrollAreaKitchensink;

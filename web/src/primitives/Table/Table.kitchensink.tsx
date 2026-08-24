/* Table.kitchensink.tsx — the inspection surface for `Tables.css`.
 *
 * THERE IS NO COMPONENT, AND THERE SHOULD NOT BE ONE. `Tables.css` contains
 * zero class names in 224 lines: every selector is rooted at the bare element
 * `table`, and the whole stylesheet is `& td`, `& th`, `& tbody th[scope="col"]`,
 * `:has(thead)`, `:has(tfoot)`. Its contract is "any HTML table", the same shape
 * as `Prose.css`. So this file imports the stylesheet directly and supplies
 * ARBITRARY table markup — there is no `<Table>` wrapper to import, because a
 * wrapper would invent a contract the source does not have and would not be
 * reachable by the selectors that do the work. See F-070.
 *
 * The demo tables are the source's own (`Views/Shared/Partials/KitchenSink/
 * _Tables.cshtml`), narrowed to the structural axes the stylesheet branches on —
 * tbody only, +thead, +tfoot, multi-row thead, colspan, rowspan, row headers,
 * and the empty table — plus the two wide cases that decide WCAG 1.4.10.
 *
 * Every table here has a `<caption>` and `scope` on every header cell. The
 * source's demos mostly do not, and three of them use `<th>` with no `scope` at
 * all. That is a deliberate correction, not a port: atomica11y's `table.md`
 * requires a caption and identified row/column headers, and this is the only
 * inspection surface the primitive has. F-071.
 */

import type { ReactNode } from "react";

import { Block, Cell, Section } from "@/components/kitchensink-ui";
import "./Tables.css";
import { TableScroll } from "./TableScroll";

/* EVERY data table on this page is wrapped, and that is the finding.
 *
 * An element-level table stylesheet CANNOT satisfy WCAG 1.4.10 on its own. A
 * five-column table of real names has a min-content width of ~500 px; nothing a
 * `table { }` rule can say makes that fit 320 px, because the only mechanisms
 * that would — a scroll container, or a display change — are either forced to
 * `visible` on a table box (F-072) or destroy the table semantics the stylesheet
 * and atomica11y both depend on. Measured: 578 px of document overflow at 320 px
 * for the 12-column case, 219 px for the plain five-column one.
 *
 * So the "no component" verdict has exactly ONE limit: reflow puts a single
 * wrapper element into the contract. That is the whole markup requirement this
 * stylesheet turns out to have, and the source app never discovered it because
 * every one of its own demos is narrow. F-088.
 */
function Framed({ label, children }: { label: string; children: ReactNode }) {
  return <TableScroll label={label}>{children}</TableScroll>;
}

const ROWS = [
  ["Margaret Nguyen", "427311", "June 3, 2010", "n/a", "0.00"],
  ["Edvard Galinski", "533175", "January 13, 2011", "April 8, 2017", "37.00"],
  ["Hoshi Nakamura", "601942", "July 23, 2012", "n/a", "15.00"],
];

export function TableKitchensink() {
  return (
    <>
      <Section
        id="table-structure"
        title="Structural axes — what the stylesheet branches on"
      >
        <Block title="tbody only — the corner-radius base case">
          <Cell caption="no thead, no tfoot">
            <Framed label="Cells with no header rows">
              <table>
                <caption>Cells with no header rows</caption>
                <tbody>
                  {[1, 2, 3].map((r) => (
                    <tr key={r}>
                      {[1, 2, 3, 4].map((c) => (
                        <td key={c}>{`Cell ${r}-${c}`}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Framed>
          </Cell>
        </Block>

        <Block title="thead — :has(thead) moves the top radius up and bands the header">
          <Cell caption="thead + tbody">
            <Framed label="Header row with a banded background">
              <table>
                <caption>Header row with a banded background</caption>
                <thead>
                  <tr>
                    {[1, 2, 3, 4].map((c) => (
                      <th scope="col" key={c}>{`Header ${c}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map((r) => (
                    <tr key={r}>
                      {[1, 2, 3, 4].map((c) => (
                        <td key={c}>{`Cell ${r}-${c}`}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Framed>
          </Cell>
        </Block>

        <Block title="tfoot — :has(tfoot) moves the bottom radius down">
          <Cell caption="thead + tbody + tfoot">
            <Framed label="Both header and footer bands">
              <table>
                <caption>Both header and footer bands</caption>
                <thead>
                  <tr>
                    {[1, 2, 3, 4].map((c) => (
                      <th scope="col" key={c}>{`Header ${c}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2].map((r) => (
                    <tr key={r}>
                      {[1, 2, 3, 4].map((c) => (
                        <td key={c}>{`Cell ${r}-${c}`}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    {[1, 2, 3, 4].map((c) => (
                      <td key={c}>{`Footer ${c}`}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </Framed>
          </Cell>
        </Block>

        <Block title="Row headers — the diagonal-hatch tbody th[scope=row] rule">
          <Cell caption="th[scope=col] in thead, th[scope=row] in tbody">
            <Framed label="Status of the club members 2021">
              <table>
                <caption>Status of the club members 2021</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">ID</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Canceled</th>
                    <th scope="col">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(([name, ...rest]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      {rest.map((v, i) => (
                        <td key={i}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={4}>
                      Total balance
                    </th>
                    <td>52.00</td>
                  </tr>
                </tfoot>
              </table>
            </Framed>
          </Cell>
        </Block>

        <Block title="Spans — the two cases the source stylesheet marks WIP">
          <Cell caption="colspan">
            <Framed label="Various colspans, no thead">
              <table>
                <caption>Various colspans, no thead</caption>
                <tbody>
                  <tr>
                    <td>Cell 1-1</td>
                    <td>Cell 1-2</td>
                    <td>Cell 1-3</td>
                    <td>Cell 1-4</td>
                  </tr>
                  <tr>
                    <td colSpan={2}>Cell 2-1</td>
                    <td colSpan={2}>Cell 2-2</td>
                  </tr>
                  <tr>
                    <td colSpan={4}>Cell 3-1</td>
                  </tr>
                </tbody>
              </table>
            </Framed>
          </Cell>
          <Cell caption="rowspan — the known WIP left-border case">
            <Framed label="A rowspan in the first column">
              <table>
                <caption>A rowspan in the first column</caption>
                <tbody>
                  <tr>
                    <td rowSpan={2}>Spans two rows</td>
                    <td>Cell 1-2</td>
                    <td>Cell 1-3</td>
                  </tr>
                  <tr>
                    <td>Cell 2-2</td>
                    <td>Cell 2-3</td>
                  </tr>
                  <tr>
                    <td>Cell 3-1</td>
                    <td>Cell 3-2</td>
                    <td>Cell 3-3</td>
                  </tr>
                </tbody>
              </table>
            </Framed>
          </Cell>
        </Block>

        <Block title="Multi-row thead with rowspan — the source's own 'double border' bug report">
          <Cell caption="two header rows, rowspan + colspan">
            <Framed label="Membership dates grouped under one header">
              <table>
                <caption>Membership dates grouped under one header</caption>
                <thead>
                  <tr>
                    <th scope="col" rowSpan={2}>
                      Name
                    </th>
                    <th scope="col" rowSpan={2}>
                      ID
                    </th>
                    <th scope="colgroup" colSpan={2}>
                      Membership Dates
                    </th>
                    <th scope="col" rowSpan={2}>
                      Balance
                    </th>
                  </tr>
                  <tr>
                    <th scope="col">Joined</th>
                    <th scope="col">Canceled</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(([name, ...rest]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      {rest.map((v, i) => (
                        <td key={i}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Framed>
          </Cell>
        </Block>

        <Block title="Empty table — every :has() branch with no content to size it">
          <Cell caption="tbody, all cells empty">
            <Framed label="An empty grid">
              <table>
                <caption>An empty grid</caption>
                <tbody>
                  {[1, 2, 3].map((r) => (
                    <tr key={r}>
                      {[1, 2, 3, 4].map((c) => (
                        <td key={c} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Framed>
          </Cell>
        </Block>
      </Section>

      <Section id="table-reflow" title="Reflow — the wide table at 320 px">
        {/* THE UNWRAPPED COUNTEREXAMPLE IS NOT ON THIS PAGE, deliberately.
            A 12-column table with no scroll wrapper measured 578 px of document
            horizontal overflow at 320 px — and a kitchensink that fails WCAG
            1.4.10 is a defect in the kitchensink, not a demonstration (CLAUDE.md
            is explicit about this; one fixed-width demo previously put 9 px of
            scroll on the shared page). The number lives in the step-1 snapshot
            and in F-072; the page shows the version that passes. */}
        <Block title="Wrapped in TableScroll — 12 columns at any viewport">
          <Cell caption="scroll region, keyboard-reachable">
            <TableScroll label="Quarterly figures by region, scrollable">
              <WideTable caption="Scrolls inside its own region" />
            </TableScroll>
          </Cell>
        </Block>

        <Block title="A narrow table needs no wrapper">
          <Cell caption="4 columns">
            <table>
              <caption>Fits at 320 px without a scroll container</caption>
              <thead>
                <tr>
                  <th scope="col">Region</th>
                  <th scope="col">Q1</th>
                  <th scope="col">Q2</th>
                </tr>
              </thead>
              <tbody>
                {REGIONS.slice(0, 3).map((r, i) => (
                  <tr key={r}>
                    <th scope="row">{r}</th>
                    <td>{1000 + i * 137}</td>
                    <td>{1200 + i * 91}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cell>
        </Block>
      </Section>
    </>
  );
}

const REGIONS = ["Nord", "Syd", "Öst", "Väst", "Mitt"];

function WideTable({ caption }: { caption: string }) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Region</th>
          {Array.from({ length: 11 }, (_, i) => (
            <th scope="col" key={i}>{`Period ${i + 1}`}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {REGIONS.map((region, r) => (
          <tr key={region}>
            <th scope="row">{region}</th>
            {Array.from({ length: 11 }, (_, i) => (
              <td key={i}>
                {(1000 + r * 137 + i * 29).toLocaleString("sv-SE")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

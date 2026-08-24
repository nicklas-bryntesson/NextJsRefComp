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

function Plain({ children }: { children: ReactNode }) {
  /* `Cell` is `display: grid`, and a `<table>` as a grid item stretches — which
   * is what we want here — but the caption block needs the cell to be able to
   * shrink, so nothing extra is added. */
  return <>{children}</>;
}

const ROWS = [
  ["Margaret Nguyen", "427311", "June 3, 2010", "n/a", "0.00"],
  ["Edvard Galinski", "533175", "January 13, 2011", "April 8, 2017", "37.00"],
  ["Hoshi Nakamura", "601942", "July 23, 2012", "n/a", "15.00"],
];

export function TableKitchensink() {
  return (
    <>
      <Section id="table-structure" title="Structural axes — what the stylesheet branches on">
        <Block title="tbody only — the corner-radius base case">
          <Cell caption="no thead, no tfoot">
            <Plain>
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
            </Plain>
          </Cell>
        </Block>

        <Block title="thead — :has(thead) moves the top radius up and bands the header">
          <Cell caption="thead + tbody">
            <Plain>
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
            </Plain>
          </Cell>
        </Block>

        <Block title="tfoot — :has(tfoot) moves the bottom radius down">
          <Cell caption="thead + tbody + tfoot">
            <Plain>
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
            </Plain>
          </Cell>
        </Block>

        <Block title="Row headers — the diagonal-hatch tbody th[scope=row] rule">
          <Cell caption="th[scope=col] in thead, th[scope=row] in tbody">
            <Plain>
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
            </Plain>
          </Cell>
        </Block>

        <Block title="Spans — the two cases the source stylesheet marks WIP">
          <Cell caption="colspan">
            <Plain>
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
            </Plain>
          </Cell>
          <Cell caption="rowspan — the known WIP left-border case">
            <Plain>
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
            </Plain>
          </Cell>
        </Block>

        <Block title="Multi-row thead with rowspan — the source's own 'double border' bug report">
          <Cell caption="two header rows, rowspan + colspan">
            <Plain>
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
            </Plain>
          </Cell>
        </Block>

        <Block title="Empty table — every :has() branch with no content to size it">
          <Cell caption="tbody, all cells empty">
            <Plain>
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
            </Plain>
          </Cell>
        </Block>
      </Section>

      <Section id="table-reflow" title="Reflow — the wide table at 320 px">
        <Block title="Unwrapped: the stylesheet's own overflow-x: auto, which does nothing">
          {/* `overflow-x: auto` is declared on `table` in the source. `overflow`
              does not create a scroll container on a table box, so this is a
              no-op — measured, see F-072. Left here as the counterexample the
              probe pins. */}
          <Cell caption="12 columns, no wrapper (expected to overflow)">
            <Plain>
              <WideTable caption="Unwrapped — the failure case" />
            </Plain>
          </Cell>
        </Block>

        <Block title="Wrapped in TableScroll — the fix">
          <Cell caption="12 columns, scroll region">
            <TableScroll label="Quarterly figures by region, scrollable">
              <WideTable caption="Wrapped — scrolls inside its own region" />
            </TableScroll>
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
              <td key={i}>{(1000 + r * 137 + i * 29).toLocaleString("sv-SE")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

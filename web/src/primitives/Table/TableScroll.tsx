/* TableScroll.tsx — the ONE piece of React this stylesheet justifies.
 *
 * It is not a `<Table>`. It wraps arbitrary table markup in a keyboard-operable
 * horizontal scroll region, which is the only way a wide data table satisfies
 * WCAG 1.4.10 Reflow at 320 px without destroying the table semantics that
 * `Tables.css` and atomica11y's `table.md` both depend on.
 *
 * WHY IT IS NEEDED. `Tables.css` declares `overflow-x: auto` on `table` itself.
 * That is a no-op: a table box is not a scroll container, so the declaration
 * computes and does nothing, and a 12-column table pushes the DOCUMENT sideways.
 * Measured at 320 px before this wrapper existed — see O-09. The source app
 * never noticed because its own table demos are all narrow.
 *
 * WHY THE WRAPPER IS FOCUSABLE AND THE TABLE IS NOT. `table.md` criterion 1 is
 * explicit: "I SEE the table scrolls into view (but is not focusable)". WCAG
 * 2.1.1 needs a scrollable region to be reachable by keyboard. Both hold only if
 * the focus target is the wrapper — putting `tabindex` on the `<table>` would
 * satisfy axe's `scrollable-region-focusable` and violate the atomica11y
 * criterion at the same time. O-10.
 *
 * Server Component: it computes no state.
 */

import type { ReactNode } from "react";
import "./Tables.layered.css";

export function TableScroll({
  label,
  children,
}: {
  /** Accessible name for the scroll region. Required — a `role="region"` with
   *  no name is an axe violation, and an unnamed landmark is worse than none. */
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

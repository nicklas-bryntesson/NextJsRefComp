/* FileUpload — React port of
 * reference-components/src/partials/components/FileUpload.
 *
 * `'use client'` is unavoidable and uncontroversial: the whole component exists
 * to react to a `change` on a hidden `input[type=file]`, to clicks on remove
 * buttons, and to native drag events. Nothing here is computable on the server.
 *
 * Three things are load-bearing and easy to get wrong:
 *
 * 1. **Class names are the contract.** FileUpload's spec carries the highest
 *    class-selector density in the library (53 selectors — Findings F-008):
 *    `.FileUpload`, `.label`, `.input`, `.list`, `.selected`, `.item`,
 *    `.item-name`, `.item-size`, `.item-error`, `.item-remove`, `.trigger`,
 *    `.drop-label`. Every one is preserved verbatim; utilities layer alongside
 *    in Phase B, never instead.
 *
 * 2. **The native input stays UNCONTROLLED.** `input[type=file]` has no `value`
 *    React may set. The component owns an `entries` array and writes the valid
 *    subset back through `DataTransfer` in an effect — which is exactly what the
 *    reference does, for the same reason.
 *
 * 3. **`accept`, `multiple` and `data-max-size` are read from the DOM, not from
 *    props, at validation time.** The conformance suite mutates them with
 *    `setAttribute` inside `page.evaluate` and then expects the next selection to
 *    honour the new value. Props would be stale. See findings/FileUpload.md.
 *
 * `data-initialized` is emitted only after hydration (`useSyncExternalStore`
 * with a server snapshot of `false`), which is both the honest value and what
 * keeps the suite from interacting with markup whose handlers are not attached
 * yet. `e2e-helpers/target.js` resolves this component's target as
 * `[data-component="FileUpload"][data-initialized]`, so the attribute must
 * exist — Findings F-010.
 */

"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ReactNode,
} from "react";

import "./FileUpload.layered.css";

/* ── Pure utilities, ported verbatim from FileUpload.ts ─────────────────────── */

export type FileSource = "user" | "server";
export type FileStatus = "valid" | "invalid-type" | "invalid-size";

export function parseMaxSize(value: string): number {
  const lower = value.toLowerCase().trim();
  if (lower.endsWith("mb")) return parseFloat(lower) * 1_000_000;
  if (lower.endsWith("kb")) return parseFloat(lower) * 1_000;
  return parseFloat(lower);
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1).replace(/\.0$/, "")} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1).replace(/\.0$/, "")} KB`;
  return `${bytes} B`;
}

export function validateAccept(
  file: { name: string; type: string },
  accept: string | undefined,
): boolean {
  if (!accept) return true;
  const rules = accept.split(",").map((r) => r.trim().toLowerCase());
  const nameParts = file.name.split(".");
  const ext =
    nameParts.length > 1 ? "." + nameParts[nameParts.length - 1].toLowerCase() : "";
  const mime = file.type.toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith(".")) return ext === rule;
    if (rule.endsWith("/*")) return mime.startsWith(rule.slice(0, -2) + "/");
    return mime === rule;
  });
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type SeedFile = {
  name: string;
  size: number;
  type: string;
  ref?: string;
};

type FileEntry = {
  id: string;
  source: FileSource;
  file: File | null;
  ref: string | null;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
};

const DEFAULTS = {
  labelTrigger: "Add file",
  labelTriggerMultiple: "Add files",
  labelRemove: "Remove {name}",
  errorAccept: "File type not allowed",
  errorSize: "File exceeds maximum size",
  labelDropZone: "Drop files here",
} as const;

/* The validator is a pure function of the entry and the two constraints, NOT a
   closure over refs. That is not style: `react-hooks/refs` reports "Cannot
   access refs during render" for a function that reads `ref.current` and is
   called from a `useState` initializer, which is exactly what the seeding path
   does. Passing the constraints in keeps the seeding render pure and lets the
   handlers pass the LIVE DOM values instead — see findings/FileUpload.md. */
function validateEntry(
  entry: FileEntry,
  acceptValue: string | undefined,
  maxSizeValue: string | undefined,
): FileEntry {
  if (acceptValue && !validateAccept({ name: entry.name, type: entry.type }, acceptValue)) {
    return { ...entry, status: "invalid-type" };
  }
  if (maxSizeValue) {
    const maxBytes = parseMaxSize(maxSizeValue);
    if (entry.size > maxBytes) return { ...entry, status: "invalid-size" };
  }
  return entry;
}


/* Hydration signal. Same shape as MotionRegion's: the server snapshot is the
   only value the server can honestly report. */
const noopSubscribe = () => () => {};
const getHydrated = () => true;
const getHydratedServer = () => false;

export type FileUploadProps = {
  /** Rendered as `data-id`. Our own anchor; nothing in the suite selects it. */
  id?: string;
  /** Visible group label. Wired to the root's `aria-labelledby`. */
  label: ReactNode;
  multiple?: boolean;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  /** `data-max-size` — `"5mb"` / `"500kb"` / raw bytes. */
  maxSize?: string;
  dropZone?: boolean;
  /** Pins `data-dragging-over` for the static visual state. */
  draggingOver?: boolean;
  labelDropZone?: string;
  /** `data-initial-files` — server-provided metadata. Emitted as the attribute
   *  AND parsed for the initial entries, exactly as the reference does. */
  initialFiles?: string;
  /** Pre-rendered entries with NO `data-initial-files` attribute — the React
   *  equivalent of the reference's "preserve authored static markup" branch. */
  files?: SeedFile[];
  labelTrigger?: string;
  labelTriggerMultiple?: string;
  labelRemove?: string;
  errorAccept?: string;
  errorSize?: string;
  /** `data-test-state` — the kitchensink's forced hover/focus/active columns. */
  testState?: "hover" | "focus" | "active";
  className?: string;
};

export function FileUpload({
  id,
  label,
  multiple = false,
  accept,
  required = false,
  disabled = false,
  maxSize,
  dropZone = false,
  draggingOver = false,
  labelDropZone = DEFAULTS.labelDropZone,
  initialFiles,
  files,
  labelTrigger = DEFAULTS.labelTrigger,
  labelTriggerMultiple = DEFAULTS.labelTriggerMultiple,
  labelRemove = DEFAULTS.labelRemove,
  errorAccept = DEFAULTS.errorAccept,
  errorSize = DEFAULTS.errorSize,
  testState,
  className,
}: FileUploadProps) {
  const uid = useId();
  const labelId = `${uid}-label`;

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const setContainer = (el: HTMLElement | null) => {
    containerRef.current = el;
  };

  const initialized = useSyncExternalStore(noopSubscribe, getHydrated, getHydratedServer);


  const [entries, setEntries] = useState<FileEntry[]>(() => {
    const seeds: Array<{ seed: SeedFile; source: FileSource }> = [];
    if (initialFiles) {
      try {
        const parsed = JSON.parse(initialFiles) as SeedFile[];
        for (const seed of parsed) seeds.push({ seed, source: "server" });
      } catch {
        /* Malformed JSON is ignored, as in the reference. */
      }
    }
    for (const seed of files ?? []) seeds.push({ seed, source: "user" });
    return seeds.map(({ seed, source }, i) =>
      validateEntry(
        {
          id: `${uid}-s${i}`,
          source,
          file: null,
          ref: seed.ref ?? null,
          name: seed.name,
          size: seed.size,
          type: seed.type,
          status: "valid",
        },
        accept,
        maxSize,
      ),
    );
  });

  /* Monotonic suffix for user-selected entries. */
  const nextUserId = useRef(0);
  /* Which control to focus after the next commit: an entry id, or "trigger". */
  const pendingFocus = useRef<string | null>(null);

  const hasFiles = entries.length > 0;
  const hasErrors = entries.some((e) => e.status !== "valid");

  /* Write the valid, user-selected subset back to the uncontrolled input. This
     is the one place the component touches `input.files`; invalid entries stay
     visible in the list but never reach the form payload. */
  useEffect(() => {
    const input = inputRef.current;
    if (!input || typeof DataTransfer === "undefined") return;
    const dt = new DataTransfer();
    for (const entry of entries) {
      if (entry.source === "user" && entry.status === "valid" && entry.file) {
        dt.items.add(entry.file);
      }
    }
    try {
      input.files = dt.files;
    } catch {
      /* Some environments disallow direct assignment. */
    }
  }, [entries]);

  /* Focus restoration after a removal. Runs on every commit and is self-clearing;
     the DOM node it targets only exists after React has re-rendered the list. */
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target === "trigger") {
      triggerRef.current?.focus();
      return;
    }
    containerRef.current
      ?.querySelector<HTMLButtonElement>(`[data-entry-id="${target}"] .item-remove`)
      ?.focus();
  });

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files;
    if (!selected || selected.length === 0) return;
    /* The LIVE DOM values, not the props: the suite mutates `accept`,
       `multiple` and `data-max-size` with `setAttribute` inside
       `page.evaluate` and expects the very next selection to honour them. */
    const isMultiple = inputRef.current?.multiple ?? multiple;
    const liveAccept = inputRef.current?.getAttribute("accept") ?? undefined;
    const liveMaxSize = rootRef.current?.dataset.maxSize ?? undefined;
    const added = Array.from(selected).map((file) =>
      validateEntry(
        {
          id: `${uid}-u${nextUserId.current++}`,
          source: "user",
          file,
          ref: null,
          name: file.name,
          size: file.size,
          type: file.type,
          status: "valid",
        },
        liveAccept,
        liveMaxSize,
      ),
    );
    setEntries((prev) => (isMultiple ? [...prev, ...added] : added));
  }

  function onRemove(entryId: string) {
    const isMultiple = inputRef.current?.multiple ?? multiple;
    if (!isMultiple) {
      pendingFocus.current = "trigger";
    } else {
      const index = entries.findIndex((e) => e.id === entryId);
      const neighbour = entries[index + 1] ?? entries[index - 1];
      pendingFocus.current = neighbour ? neighbour.id : "trigger";
    }
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  /* Drag depth, so a dragleave from a child does not clear the highlight. */
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const dropHandlers = dropZone
    ? {
        onDragEnter: () => {
          dragDepth.current++;
          setDragging(true);
        },
        onDragLeave: () => {
          dragDepth.current--;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        },
        onDrop: () => {
          dragDepth.current = 0;
          setDragging(false);
        },
      }
    : {};

  const errorFor = (status: FileStatus) =>
    status === "invalid-type" ? errorAccept : errorSize;

  /* The `{" "}` separators are NOT cosmetic. In single mode `.selected` is
     `display: block`, so these spans are INLINE — and every one of them is
     `white-space: nowrap` in the verbatim stylesheet. The reference's Handlebars
     partials put each span on its own source line, which gives the browser a
     soft-wrap opportunity between them; JSX siblings produce no whitespace text
     node at all, so the whole row becomes one unbreakable line. Measured at
     320px: min-content 285px without the separators, 155px with them — the
     difference between overflowing the page and reflowing (WCAG 1.4.10). In
     multiple mode `.item` is a flex row, where whitespace text nodes are
     discarded, so this is inert there. See findings/FileUpload.md. */
  function entryParts(entry: FileEntry) {
    return (
      <>
        <span className="item-name">{entry.name}</span>{" "}
        <span className="item-size">{formatFileSize(entry.size)}</span>{" "}
        {entry.status !== "valid" && (
          <>
            <span className="item-error" role="alert">
              {errorFor(entry.status)}
            </span>{" "}
          </>
        )}
        <button
          type="button"
          className="item-remove"
          aria-label={interpolate(labelRemove, { name: entry.name })}
          onClick={() => onRemove(entry.id)}
        >
          {"×"}
        </button>
        {entry.source === "server" && entry.ref && (
          <input type="hidden" name="uploaded-ref" value={entry.ref} />
        )}
      </>
    );
  }

  const single = entries[0];

  return (
    <div
      ref={rootRef}
      className={className ? `FileUpload ${className}` : "FileUpload"}
      data-component="FileUpload"
      data-id={id}
      role="group"
      aria-labelledby={labelId}
      data-initialized={initialized ? "true" : undefined}
      data-has-files={hasFiles ? "true" : undefined}
      data-has-errors={hasErrors ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      aria-disabled={disabled ? "true" : undefined}
      data-required={required ? "true" : undefined}
      data-max-size={maxSize}
      data-drop-zone={dropZone ? "true" : undefined}
      data-label-drop-zone={dropZone ? labelDropZone : undefined}
      data-dragging-over={dropZone && (dragging || draggingOver) ? "true" : undefined}
      data-initial-files={initialFiles}
      data-test-state={testState}
      {...dropHandlers}
    >
      <span id={labelId} className="label">
        {label}
      </span>
      <input
        ref={inputRef}
        className="input"
        type="file"
        aria-hidden="true"
        tabIndex={-1}
        multiple={multiple || undefined}
        accept={accept}
        required={required || undefined}
        disabled={disabled || undefined}
        onChange={onChange}
      />
      {/* Injected by the reference's JS, not authored by consumers — decorative,
          so `aria-hidden`; the trigger button remains the accessible action. */}
      {dropZone && (
        <span className="drop-label" aria-hidden="true">
          {labelDropZone}
        </span>
      )}

      {multiple ? (
        <ul
          ref={setContainer}
          className="list"
          aria-live="polite"
          aria-relevant="additions removals"
          aria-label="Selected files"
        >
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="item"
              data-status={entry.status}
              data-entry-id={entry.id}
              data-source={entry.source === "server" ? "server" : undefined}
            >
              {entryParts(entry)}
            </li>
          ))}
        </ul>
      ) : (
        <div
          ref={setContainer}
          className="selected"
          aria-live="polite"
          aria-atomic="true"
          data-status={single ? single.status : undefined}
        >
          {single && entryParts(single)}
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        className="trigger"
        disabled={disabled || undefined}
        onClick={() => inputRef.current?.click()}
      >
        {multiple ? labelTriggerMultiple : labelTrigger}
      </button>
    </div>
  );
}

export default FileUpload;

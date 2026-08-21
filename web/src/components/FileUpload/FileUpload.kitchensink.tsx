/* FileUpload kitchensink — every state the reference's FileUpload.html shows.
 *
 * DOM ORDER IS TEST CONTRACT here, in two places:
 *
 * 1. The suite resolves the interactive instance with `.last()` on
 *    `[data-component="FileUpload"][data-initialized="true"]`. The **live demo
 *    must therefore be the last FileUpload on the page** — the reference's own
 *    ordering, and the reason the "Native reference" block (plain inputs, not
 *    FileUpload roots) can still come after it.
 * 2. The drop-zone test takes `.first()` on
 *    `[data-drop-zone="true"][data-initialized="true"]` and drives a real
 *    selection + removal through it, so the **plain** drop-zone comes before the
 *    pinned `data-dragging-over` one.
 *
 * `data-id` is ours — `e2e-helpers/target.js` resolves FileUpload by
 * `[data-initialized]` alone, not by an id — but the anchors make each state
 * probe-able and keep the aggregate page navigable.
 *
 * The `.item` markup the reference's states author by hand is supplied here as
 * DATA (`initialFiles` for the `data-initial-files` states, `files` for the ones
 * the reference leaves as static markup). See findings/FileUpload.md: React has
 * no "preserve the DOM the author already wrote" branch to port.
 */

import { FileUpload } from "./FileUpload";
import { Section, Block, Cell } from "../kitchensink-ui";

const REPORT = '[{"name":"report.pdf","size":200000,"type":"application/pdf"}]';

export function FileUploadKitchensink() {
  return (
    <Section id="fileupload" title="FileUpload">
      <Block title="Interaction states — empty">
        <Cell caption="default">
          <FileUpload id="fileupload-empty" label="File" />
        </Cell>
        <Cell caption="hover">
          <FileUpload id="fileupload-empty-hover" label="File" testState="hover" />
        </Cell>
        <Cell caption="focus">
          <FileUpload id="fileupload-empty-focus" label="File" testState="focus" />
        </Cell>
        <Cell caption="active">
          <FileUpload id="fileupload-empty-active" label="File" testState="active" />
        </Cell>
      </Block>

      <Block title="Interaction states — with files">
        <Cell caption="default">
          <FileUpload id="fileupload-with-files" label="File" initialFiles={REPORT} />
        </Cell>
        <Cell caption="hover">
          <FileUpload
            id="fileupload-with-files-hover"
            label="File"
            initialFiles={REPORT}
            testState="hover"
          />
        </Cell>
        <Cell caption="focus">
          <FileUpload
            id="fileupload-with-files-focus"
            label="File"
            initialFiles={REPORT}
            testState="focus"
          />
        </Cell>
        <Cell caption="active">
          <FileUpload
            id="fileupload-with-files-active"
            label="File"
            initialFiles={REPORT}
            testState="active"
          />
        </Cell>
      </Block>

      {/* Disabled is a FUNCTIONAL state and gets no interaction columns: the
          stylesheet sets `pointer-events: none` on every descendant, so hover
          is unreachable by construction. The `.md` is explicit that JS does not
          derive disabled from the input — it is authored on the root
          (`data-disabled` + `aria-disabled`) and on both controls. */}
      <Block title="Disabled">
        <Cell caption="empty">
          <FileUpload id="fileupload-disabled-empty" label="File" disabled />
        </Cell>
        <Cell caption="with files">
          <FileUpload
            id="fileupload-disabled-with-files"
            label="File"
            disabled
            initialFiles={REPORT}
          />
        </Cell>
      </Block>

      <Block title="Validation">
        <Cell caption="invalid type">
          <FileUpload
            id="fileupload-invalid-type"
            label="File"
            accept=".pdf"
            initialFiles='[{"name":"image.exe","size":14000,"type":"application/x-msdownload"}]'
          />
        </Cell>
        <Cell caption="invalid size">
          <FileUpload
            id="fileupload-invalid-size"
            label="File"
            maxSize="5mb"
            initialFiles='[{"name":"video.mp4","size":48000000,"type":"video/mp4"}]'
          />
        </Cell>
        <Cell caption="mixed">
          <FileUpload
            id="fileupload-invalid-mixed"
            label="File"
            multiple
            accept=".pdf"
            initialFiles='[{"name":"report.pdf","size":200000,"type":"application/pdf"},{"name":"image.exe","size":14000,"type":"application/x-msdownload"}]'
          />
        </Cell>
        <Cell caption="required + empty">
          <FileUpload id="fileupload-required-empty" label="File" required />
        </Cell>
      </Block>

      <Block title="Variants">
        <Cell caption="multiple">
          <FileUpload
            id="fileupload-multiple"
            label="Files"
            multiple
            files={[
              { name: "doc1.pdf", size: 200000, type: "application/pdf" },
              { name: "doc2.pdf", size: 350000, type: "application/pdf" },
            ]}
          />
        </Cell>
        {/* First `[data-drop-zone="true"]` — the drop-zone conformance test
            drives a selection and a removal through this instance. */}
        <Cell caption="drop-zone">
          <FileUpload id="fileupload-drop-zone" label="File" dropZone />
        </Cell>
        <Cell caption="drop-zone dragging">
          <FileUpload
            id="fileupload-drop-zone-dragging"
            label="File"
            dropZone
            draggingOver
          />
        </Cell>
        <Cell caption="server files">
          <FileUpload
            id="fileupload-server-files"
            label="CV"
            multiple
            initialFiles='[{"name":"contract.pdf","size":200000,"type":"application/pdf","ref":"abc123"}]'
          />
        </Cell>
      </Block>

      {/* LAST FileUpload on the page — the suite's `.last()` target. */}
      <Block title="Live demo">
        <Cell caption="live">
          <FileUpload id="fileupload-live" label="Upload files" multiple />
        </Cell>
      </Block>

      {/* Not FileUpload roots, so they do not disturb `.last()`.
          `w-full min-w-0` is REFLOW, not styling: Chromium gives a bare
          `input[type=file]` an intrinsic min-content width of 344px (its shadow
          "Choose File / No file chosen" is unshrinkable), which overflowed the
          238px demo cell at a 320px viewport and put a horizontal scrollbar on
          the whole shared page. WCAG 1.4.10, and axe does not test it. F-NEW. */}
      <Block title="Native reference">
        <Cell caption="single">
          <div className="grid gap-xxs">
            <label htmlFor="fu-native-single" className="text-body-sm text-body">
              File
            </label>
            <input
              type="file"
              id="fu-native-single"
              name="fu-native-single"
              className="w-full min-w-0"
            />
          </div>
        </Cell>
        <Cell caption="multiple">
          <div className="grid gap-xxs">
            <label htmlFor="fu-native-multiple" className="text-body-sm text-body">
              Files
            </label>
            <input
              type="file"
              id="fu-native-multiple"
              name="fu-native-multiple"
              multiple
              className="w-full min-w-0"
            />
          </div>
        </Cell>
      </Block>
    </Section>
  );
}

export default FileUploadKitchensink;

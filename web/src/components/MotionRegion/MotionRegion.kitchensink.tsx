/* MotionRegion kitchensink — every state and every `data-id` anchor the
 * conformance suite needs, mirroring the reference's MotionRegion.html.
 *
 * The suite's single target is `[data-component="MotionRegion"][data-id="motion-region-live"]`
 * (e2e-helpers/target.js), so `motion-region-live` must be the CSS-animated,
 * autostarting instance. `.kitchensink-section` comes from <Section> and is test
 * contract, not styling (Findings F-014).
 *
 * The animated media below is authored content that obeys `data-motion` — it is
 * not part of the component and never touches the kernel.
 */

import { Block, Cell, Section } from "@/components/kitchensink-ui";

import { MotionRegion } from "./MotionRegion";
import "./MotionRegion.kitchensink.css";

/* Remote demo media, the same URLs the reference's `{{poc}}` helper resolves to. */
const POC = "https://nicklas-bryntesson.github.io/poc-assets/";

export function MotionRegionKitchensink() {
  return (
    <Section id="motionregion" title="MotionRegion">
      <p className="mb-xl max-w-[70ch] text-body-md">
        Governs decorative motion for accessibility and performance. The animated
        backend is authored content that obeys <code>data-motion</code>; below it is
        a CSS animation gated with zero JS. Toggle the control, enable your OS
        &ldquo;reduce motion&rdquo; setting, or scroll a region out of view to see
        the policy react.
      </p>

      <Block title="Live demo — CSS-animated backend (autostart)">
        <Cell caption='data-autoplay="policy"'>
          <MotionRegion
            id="motion-region-live"
            autoplay="policy"
            playText="Play background animation"
            pauseText="Pause background animation"
            className="motion-region-demo"
          >
            <div className="demo-animation" role="presentation" />
          </MotionRegion>
        </Cell>
      </Block>

      <Block title="Autoplay off — waits for the user">
        <Cell caption='data-autoplay="off"'>
          <MotionRegion
            id="motion-region-off"
            autoplay="off"
            playText="Play background animation"
            pauseText="Pause background animation"
            className="motion-region-demo"
          >
            <div className="demo-animation" role="presentation" />
          </MotionRegion>
        </Cell>
      </Block>

      <Block title="Video backend (preload none until policy plays)">
        <Cell caption="built-in video adapter">
          <MotionRegion
            id="motion-region-video"
            autoplay="policy"
            playText="Play background video"
            pauseText="Pause background video"
            className="motion-region-demo"
          >
            <div className="media-container" role="presentation">
              <video
                loop
                muted
                playsInline
                preload="none"
                poster={`${POC}video-src/multicolored-background-1280x720.jpg`}
              >
                <source
                  src={`${POC}video-src/multicolored-background-1280x720.webm`}
                  type="video/webm"
                />
                <source
                  src={`${POC}video-src/multicolored-background-1280x720.mp4`}
                  type="video/mp4"
                />
              </video>
              <noscript>
                {/* The progressive-enhancement floor: with no JS, a native-controls
                    video renders — fully accessible and user-controllable. */}
                <video
                  controls
                  loop
                  muted
                  playsInline
                  preload="none"
                  poster={`${POC}video-src/multicolored-background-1280x720.jpg`}
                >
                  <source
                    src={`${POC}video-src/multicolored-background-1280x720.webm`}
                    type="video/webm"
                  />
                </video>
              </noscript>
            </div>
          </MotionRegion>
        </Cell>
      </Block>
    </Section>
  );
}

export default MotionRegionKitchensink;

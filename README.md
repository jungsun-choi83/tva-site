# TVA studio

Six-page local implementation: MAIN → DROP → ABOUT → PORTFOLIO → ORIGINAL → CONTACT → ENDING. DROP is a transition, not an extra menu page.

## Preview

Open http://127.0.0.1:18768/ on this computer. Start the server if needed:

```sh
python3 -m http.server 18768 --bind 127.0.0.1 --directory /Users/mac/Documents/Codex/2026-09-04/x20/outputs/tva-studio
```

No build, package installation, bundler or framework is needed. Use an HTTP server; file:// cannot load the ES modules. The former `tva-on-air-mvp` and source gallery/QA tasks were not changed.

After source edits, use a hard refresh or fresh browser context to discard cached ES modules. The verification run starts from a fresh context.

## Included

- Existing blue main graphic and television, live WebGL signal modes and typography particles.
- Scroll-driven fall into a four-screen-wide, six-stop studio introduction. Four working paper/plan/material interactions, original CRT character poses, keyboard movement and reduced-motion linear layout.
- Existing concave gallery geometry and source images, bounded wheel rendering, searchable/filterable/sortable grid and list, details and contextual inquiries.
- Four separately addressable imported-work folios. Their roles are import, not self-created IP.
- QA-derived envelope, seven-field letter, required-field checks, contextual inquiry, current-tab draft preservation, local download/copy, explicitly simulated courier delivery.
- White portfolio-and-later surfaces, English navigation from ABOUT onward, no NOTICE page, state-preserving ending replay. The mobile motion preference control is in the footer; system reduced-motion preference is honored immediately.

## Content and service boundaries

The eight photographs are explicitly labelled local visual studies, not verified TVA client projects. Replace records in `portfolio-data.js` with the actual project inventory and approved assets in `gallery-assets/`. Categories derive from the records. Do not remove the demo disclosure before real company data is loaded.

The four imported works await their official title, creator, artwork and import details. The four folios and deep links work now; `originals.js` is the content entry point. No invented title or creator is represented as real.

The letter does not send email, post to an API or persist personal data to storage. It lives in the current document only, survives navigation/replay, and is lost on reload. Download/copy are explicit actions. A real receiving address, delivery backend, consent/privacy copy and error monitoring must be supplied before public launch. Google Fonts is the only external visual dependency.

## Verification

`qa/report.json` records browser workflow observations bound to source hashes, with desktop/tablet/mobile screenshots. `qa/capacity.json` records the isolated 100-record fixture check; it does not add sample records to the product.

`qa/edge-cases.json` records inertia, whitespace validation, simulated clipboard denial, cross-filter shared inquiry, browser-back draft preservation and cancellation while the envelope is opening. The contact module exposes `closeForNavigation()` for the coordinator to dismiss an open or opening letter without clearing its fields.

Current verified source passed58 surface observations, eight edge observations,30 captures, the isolated100-record fixture and a fresh live smoke path. `qa/independent-reviews.md` preserves the two independent source-bound PASS verdicts. This is a local implementation handoff, not a production publication or real-mail completion claim.

```sh
node qa/check.mjs
node qa/verify-evidence.mjs
```

The second command uses the installed Playwright CLI skill wrapper and performs a new live smoke path. Override `TVA_PLAYWRIGHT_CLI` if that wrapper is in a different location. `qa/surface.js` and `qa/capacity.js` are rerunnable browser-verification drivers, not production code.

Device screenshots are Chrome viewport emulation. Physical iPhone/Safari, a production mail workflow and Lighthouse scores are not claimed. TypeScript/Biome language servers are absent and were not installed; native syntax and live browser checks are used.

# CalmClip Rules and Conventions

These rules apply to all work on the CalmClip codebase.
They mirror the conventions used across the Quick/Calm family.
Source of truth: calm-pdf-app/rules.md (same rules, same discipline). 

## Absolute prohibitions

0. MOST IMPORTANT RULE: No guesswork or assumptions. Ever. If you do not know, stop and verify before touching any file. Every mistake in this codebase will trace back to this rule being broken. There are no exceptions. Do not hesitate to stop the task and ask me a question if you are not sure about anything. To avoid breaking this rule.
1. No em dashes or en dashes anywhere: not in code comments, strings, JSX, markdown, or aria labels. Use a colon, comma, parenthesis, or restructure the sentence instead.
2. No full rewrites without explicit user permission. Identify the smallest targeted change and make only that.
3. No placeholder code, TODO comments, or stub implementations in production files. If something is not ready, omit it and note the gap in this file.
4. No decorative glassmorphism, gradient text, or colored glow effects. No backdrop-filter blur on any surface.
5. No silent fallbacks. If a tool fails, show an explicit error message. Never produce empty output without telling the user why.

## Process rules

1. Research first, code second. Before editing any file, read all files that will be affected.
2. Verify after every change. Check that the affected component renders and no new errors appear.
3. Minimal footprint. Prefer editing existing files over creating new ones.
4. One concern at a time. Do not add extra features while fixing a bug.

## Privacy invariants (non-negotiable)

- No file data, audio, or video frames may be sent to any server. All processing must run in the browser.
- Whisper transcription must run via local WASM model, never a remote API endpoint.
- Face detection must run via local WASM model, never a remote API endpoint.
- Metadata stripping must happen before any export blob is handed to the user.

## State machine invariants

- Every tool section uses the phase pattern: idle, ready, processing, done, error.
- The error phase must show an explicit human-readable message. Never swallow exceptions silently.
- Blob URLs created with URL.createObjectURL() must be revoked when no longer needed.
- FFmpeg instances must not be re-loaded if already loaded (check cache before load).

## Design tokens

Source of truth: `src/index.css` (CSS custom properties under `@theme inline`). The app uses a **dark theme only**. There are no light-mode variables. The theme toggle in the navbar is non-functional visually and must not be modified without explicit direction.

### Colors (CSS variables)

- `--bg-page`: hsl(240 6% 7%) - darkest background, page canvas
- `--bg-surface`: hsl(240 5% 11%) - panels, cards, sidebars
- `--bg-surface-2`: hsl(240 4% 14%) - elevated surfaces, dropzone backgrounds
- `--border`: rgba(255,255,255,0.08) - standard dividers and card borders
- `--border-subtle`: rgba(255,255,255,0.04) - very faint separators
- `--primary`: hsl(340 82% 58%) - hot pink, primary actions and highlights
- `--primary-a4` through `--primary-a20`: primary at 4%/8%/10%/12%/15%/20% opacity
- `--accent`: hsl(172 66% 50%) - teal, secondary accent
- `--text-primary`: hsl(0 0% 96%) - headings and high-emphasis text
- `--text-muted`: rgba(255,255,255,0.55) - secondary labels
- `--text-faint`: rgba(255,255,255,0.35) - tertiary, placeholders
- `--text-dim`: rgba(255,255,255,0.22) - very faint, captions, footer notes
- Success: #10b981
- Warning: #f59e0b
- Error: #ef4444

### Typography

- Heading font: Space Grotesk (Google Fonts, weights 400/500/600/700)
- Body font: Inter (Google Fonts, weights 400/500/600)
- Base body font size: 14px
- Font weights used: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- Section label style: 10px, uppercase, letter-spacing 0.07em, color `--text-muted`
- Font scale: 8.5 / 10 / 11 / 12 / 13 / 14 / 15 / 16 / 18 / 20 / 24 / 32 / 48 / 64px

### Spacing

- Sidebar panel padding: 20px (p-5)
- Section gap inside sidebar: no gap (panels switch, not stack)
- Card/panel border-radius: 14-20px (landing cards), 12px (action cards), 8px (buttons)
- Sidebar tool tab strip height: ~44px (icon + label, 9px/7px padding)
- Navbar height: ~65px

### Border radius

- Landing section cards: 14-16px
- CTA / sister-tool cards: 20px
- Buttons (toolbar, nav): 8px
- Pills/badges/section labels: 8-12px
- Dropzone: 14px
- Screen record button: 10px
- Input fields: 6-8px
- Circle avatars / toggles: 50%

### Icons

- Primary icon library: lucide-react
- Sidebar tab strip icons: 12x12px
- Section header icons: 13x13px
- Toolbar button icons: 11x11px
- Action icons: 14-16x14-16px
- Navbar icons: 16x16px, color `--text-faint`

### Component patterns

- Primary button: background `--primary`, text white, height 34-36px, radius 8px, fw600
- Navbar: ~65px tall, background `--bg-surface`, border-bottom 1px solid `--border`
- Sidebar: dark `--bg-surface`, 384-420px wide, tab strip at top, single active panel below
- Sidebar tab strip: 9 icon tabs in a grid, active tab has primary underline + tinted background
- Feature pills: background `--bg-surface`, border 1px solid `--border`, radius 20px
- Hover effects: background and border-color change only, no blur, no glow, no transform
- Section headers: 10px uppercase label, lucide icon at 13px, `--text-muted` color
- Dividers: 1px solid `--border-subtle`

## Architecture invariants

- Components live in src/components/. Logic (non-UI) lives in src/lib/.
- Each feature's heavy processing function lives in its own lib file.
- No inline styles for colors that are part of the design token system. Use the token values consistently.
- TypeScript strict mode is on. No use of `any` without a cast comment explaining why.
- All range inputs use the dual-range CSS pattern already established in index.css.

## Known gaps and planned work

See ROADMAP.md for the full feature plan and current status.

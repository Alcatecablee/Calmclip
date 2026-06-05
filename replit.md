# CalmClip Rules and Conventions

These rules apply to all work on the CalmClip codebase.
They mirror the conventions used across the Quick/Calm family.
Source of truth: calm-pdf-app/rules.md (same rules, same discipline).

## Absolute prohibitions

0. MOST IMPORTANT RULE: No guesswork or assumptions. Ever. If you do not know, stop and verify before touching any file. Every mistake in this codebase will trace back to this rule being broken. There are no exceptions.
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

Source: current production styles in src/index.css and src/App.tsx. The app uses a light theme throughout.

### Colors

- Background (main surface): #f5f5f7
- Panel/card (white surface): #ffffff
- Border/divider: #e4e4e8
- Subtle border: rgba(15,15,17,0.06)
- Hover surface: rgba(15,15,17,0.04)
- Accent (primary): #03a9f4
- Accent hover: #0d92d0
- Accent light: #29b6f6
- Text primary: #0f0f11
- Text secondary (65%): rgba(15,15,17,0.65)
- Text tertiary (44%): rgba(15,15,17,0.44)
- Text muted (32%): rgba(15,15,17,0.32)
- On-accent text: rgba(0,0,0,0.87)
- Success: #10b981
- Warning: #f59e0b
- Error: #ef4444

### Typography

- Primary font: Ubuntu (Google Fonts, weights 300/400/500/700)
- Secondary/body font: Roboto, RobotoFallback, Helvetica, Arial, sans-serif
- Base body font size: 14px
- Base line height: 18px (1.286 ratio at 14px)
- Font weights used: 400 (regular), 500 (medium), 700 (bold), 900 (icon solid)
- Letter spacing: normal for body; 0.56px for uppercase labels
- Text transform: uppercase on primary action buttons only
- Font scale: 12 / 13 / 14 / 15 / 16 / 18 / 20 / 22 / 24 / 32px

### Spacing

- Nav item gap: 4px
- Nav item padding: 12px top/bottom, 16px left/right
- Icon column width: 46px
- Table cell padding: 20px top/bottom, 16px left/right (default); 14px top/bottom (active row)
- Popup padding: 24px all sides
- Popup header height: 64px
- Button height: 36px

### Border radius

- Standard (cards, inputs, buttons, nav items): 4px
- Active nav item top corners only: 4px 4px 0px 0px
- Pills/badges: 21px
- Circle avatars: 50%

### Icons

- Primary icon library: lucide-react
- Section icon size: 13x13px, color inherited from parent
- Action icon size: 16x16px
- Navbar icon size: 16x16px, color rgba(15,15,17,0.58)

### Component patterns

- Primary button: background #03a9f4, text rgba(0,0,0,0.87), height 36px, radius 4px, uppercase, fw500
- Navbar: height 56px, background #ffffff, border-bottom 1px solid #e4e4e8
- Feature pills: background #ffffff, border 1px solid rgba(15,15,17,0.08), borderRadius 21px
- Links: color #03a9f4
- Hover effects: background color change only, no blur, no glow, no transform

## Architecture invariants

- Components live in src/components/. Logic (non-UI) lives in src/lib/.
- Each feature's heavy processing function lives in its own lib file.
- No inline styles for colors that are part of the design token system. Use the token values consistently.
- TypeScript strict mode is on. No use of `any` without a cast comment explaining why.
- All range inputs use the dual-range CSS pattern already established in index.css.

## Known gaps and planned work

See ROADMAP.md for the full feature plan and current status.

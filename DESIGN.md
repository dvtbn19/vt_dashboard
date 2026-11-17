# Design system

Brief (CLAUDE.md §9): a Data/AI engineer's portfolio that tells a story about engineering work, and a private lab tuned for scanning project status, runs, metrics and files — on a phone as much as on a laptop. Not a generic admin template.

## Idea

The one memorable element is the **career lanes chart** on the portfolio: the owner's real career drawn as a dataset, one bar per role in the lane it belongs to (business & finance → analysis & product → data & AI), coloured along the viridis ramp that data people know from matplotlib. Everything else stays quiet: hairline rules, generous whitespace, a single accent.

## Tokens (`apps/web/src/app/globals.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F5F7F6` | `#0E1513` | page (cool grey-green, not cream) |
| `surface` | `#FFFFFF` | `#141D1A` | panels, inputs |
| `sunken` | `#ECF0EE` | `#1A2522` | hover, code, table header |
| `line` | `#D6DDDA` | `#26332F` | hairlines |
| `ink` / `muted` | `#14201D` / `#56635F` | `#E3EBE8` / `#93A39E` | text |
| `accent` | `#0F6E62` | `#3CC2A8` | actions, links, completed/ready (viridian) |
| `run` | `#A86200` | `#E3A23B` | running, synthetic-data warnings |
| `fail` | `#B4361F` | `#F07258` | failed, destructive |
| `lane0–2` | viridis `#414487 #2A788E #1E9474` | lightened | career lanes, chart colourway |

Theme follows the OS; the moon/sun button stores an override in `localStorage`.

## Type

Be Vietnam Pro (self-hosted via @fontsource; full Vietnamese coverage) for everything, 400–700. Headline 40/56/68 px with tight tracking; body 16 px; lab labels 13–14 px. Tabular figures for every number. Monospace only for code, slugs, token prefixes and commit hashes. Sentence case, no all-caps labels.

## Layout

- Portfolio: 1120 px column; section heads in a 240 px left column on desktop, stacked on phones.
- Lab ≥1024 px: 240 px sidebar + content (max 1080 px). <1024 px: sticky top bar + bottom tab bar (Overview, Projects, Tokens), 56 px targets, safe-area padding.
- Lists are rows separated by hairlines, not card grids. Panels (`.sheet`, radius 14) only for things that are a unit: a file preview, a form, the readout strip.

## Status

Always colour + shape + word: running = amber pulsing dot, completed/ready = filled viridian dot, failed = red cross, pending = hollow grey ring.

## States

Every lab page renders designed empty, loading (skeleton), API-unreachable, forbidden, not-found and session-expired states (`ProblemState`, `loading.tsx`, `/lab/login?expired=1`).

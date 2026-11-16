# DESIGN.md — vt_dashboard design system

Source of truth for all UI in this repo (portfolio + Lab). Approved direction: **"A data person's lab notebook"** (2026-11-16).

## Concept

William moved from business (broker, BA, operations) into data. The portfolio shows that story *as data* — his career is the hero chart. The Lab is the notebook his agents write in: a time-ordered log of entries, with William's instructions shown as handwritten-style margin notes next to the result they produced.

Audiences: recruiters / hiring managers on desktop (portfolio), William on phone, iPad or laptop checking his agents (Lab). Every screen must work from 360px phones through iPad portrait/landscape to wide desktop.

## Tokens

Defined as CSS variables in `src/app/globals.css`, exposed to Tailwind via `@theme inline`.

| Token | Light | Dark (Lab only, `prefers-color-scheme`) | Use |
|---|---|---|---|
| `paper` | `#F2F4F1` | `#10151F` | page background |
| `sheet` | `#FBFCFA` | `#161D2A` | raised surfaces (report blocks, forms) |
| `ink` | `#16213A` | `#E6EAF2` | primary text, strong rules |
| `pencil` | `#5F6878` | `#9AA4B5` | secondary text |
| `rule` | `#D5DAD3` | `#273042` | hairlines, borders |
| `signal` | `#2B59FF` | `#7C9BFF` | links, actions, agents, running state |
| `redpen` | `#D93A26` | `#FF7A66` | failures, destructive, annotations of problems |
| `marker` | `#FFE14D` | `#FFE14D` (text stays `#16213A`) | **only** the highlighter behind key numbers |

The portfolio is always light (paper). The Lab follows the device's colour scheme.

Chart colourway (Plotly, theme-aware via CSS vars `--chart-1…6`): signal blue, redpen, ink/navy, teal `#0F9D8A`, violet `#7A4EDB`, ochre `#C79A00`.

## Type

- **Be Vietnam Pro** (400/500/600/700) — everything: headings, body, UI. Designed by Vietnamese type designers, full Vietnamese support.
- **Newsreader italic** (400) — *only* margin notes: chart annotations, commands William gave an agent, "triggered by" notes. Never for headings.
- No monospace for labels. Mono (system) only inside code/log blocks and tabular numbers use `font-variant-numeric: tabular-nums`.
- No all-caps tracked eyebrow labels. Section headings are sentence case.

Scale (≈1.25, base 17px): 13 · 14 · 17 · 21 · 26 · 33 · 41 · 52 · 64. Body line-height 1.6; margin notes 1.5. Measure ≤ 68ch.

## Layout

- Max content width 1180px; side gutter 20px (mobile) → 32px (≥768) → 48px (≥1280).
- Left-aligned everything. Asymmetric two-column at ≥1024px (content + side rail); single column below, with side content moving under the main content.
- Structure comes from rules (1px `rule`) and whitespace, not stacks of identical cards. `sheet` surfaces are used only for things that are objects: report blocks, forms, the hero chart.
- Radii: 4px controls, 10px sheets. No drop shadows except a 1px rule.

## Signature element

`CareerChart` — swimlane time-series of William's roles (2019 → now) on graph paper, lanes *Business & finance / Analysis & product / Data & AI*. Bars grow in sequence on first load (the only non-user-triggered motion on the portfolio; disabled under `prefers-reduced-motion`). Each bar is a button; selecting it shows the role's details and an italic margin note.

## Components & patterns

- **Highlighter** `<Mark>`: yellow marker behind a key number. Max ~1 per paragraph.
- **Margin note** `.note`: Newsreader italic, `pencil` colour, left rule in `signal` (instructions) or `redpen` (problems).
- **Status mark**: small filled square + word in sentence case (`running` signal, pulsing; `done` ink; `failed` redpen; `pending` outline signal).
- **Log entry** (Lab): time column (Sydney time) | entry. Grouped by day ("Today", "Yesterday", date).
- Buttons: solid `ink` (primary), outline `rule` (secondary). Text says the action ("Queue command", "Make public"). No arrows appended to labels.
- Focus: 2px `signal` outline, offset 2px, always visible on keyboard focus.

## Copy

Sentence case, plain verbs, from the reader's point of view. Real content only (from the CV and live data). Errors say what happened and how to fix it. Empty states invite the next action.

# VT Lab + portfolio — design system

Direction **B, "mission control"** (approved 17 Nov 2026, replacing direction A "lab notebook").
The Lab is an app William uses to watch and direct several Claude Code agents, often from his phone.
The portfolio shares the same language so the two read as one product.

## Principles

1. **Glanceable first.** The overview answers "what's running, what's waiting, what broke" in one screen, as numbers you can tap.
2. **The next action is always under the thumb.** On phones and tablets a bottom tab bar holds navigation, with a centre **+** that opens the task composer. On desktop the same action is the first item in the sidebar.
3. **Agents have identity.** Each agent gets a deterministic coloured avatar (hue from its name) so it is recognisable across cards, filters and threads.
4. **Status is colour-coded and consistent everywhere:** live teal = running or in progress (pulsing dot), amber = waiting for an agent, coral = failed, hollow grey ring = done.
5. **One container: the panel.** Radius 14, 1px hairline, no heavy shadows. Nested surfaces use `raised`, not another border.

## Tokens

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `paper` | `#0C111D` | `#F3F5F9` | app background |
| `sheet` | `#131A29` | `#FFFFFF` | panels |
| `raised` | `#1A2335` | `#EEF1F6` | inputs, chips, nested blocks, hover |
| `rule` | `#253049` | `#DDE2EC` | hairlines |
| `ink` | `#E8EDF6` | `#111827` | text |
| `pencil` | `#8F9BB3` | `#5B6578` | secondary text |
| `signal` | `#7B93FF` | `#3D5AFE` | actions, links, selection, primary chart series |
| `live` | `#2FD3BD` | `#0B8F7D` | running |
| `warn` | `#F2B84B` | `#A8670A` | waiting |
| `redpen` | `#FF6E5E` | `#D23C2A` | failed, destructive |
| `marker` | `#FFE066` | `#FFE066` | highlighter behind one key number only |

Theme: dark by default; the sun/moon button sets a `theme` cookie and `data-theme` on `<html>`. Plotly charts read the tokens and redraw when the theme changes. Chart series use `--chart-1…6`.

## Type

- **Be Vietnam Pro** (self-hosted, full Vietnamese coverage) for everything, weights 400/500/600/700.
- Monospace only for code and run logs.
- Scale: 12.5 / 13 / 14 / 15 / 16 (body) / 17 / 20 / 26 / 32, display 38–64 on the portfolio hero.
- Numbers use tabular figures (`.tnum`).
- Sentence case. No all-caps labels.

## Layout

- **≥1024px (desktop, iPad landscape):** 252px sticky sidebar (wordmark, New task, nav, language/theme/sign-in at the bottom) + content max 1200px.
- **<1024px (phones, iPad portrait):** slim sticky top bar + fixed bottom tab bar (Overview, Reports, **+**, Commands, Projects). Content gets bottom padding for the bar and the safe area.
- Gutters 16 / 28 / 40. Touch targets ≥ 44px; chips 38px; inputs 46px with 16px text (no iOS zoom).
- Filter chips scroll sideways on phones and wrap on larger screens.

## Components

- `StatTile`: label, big number in its status colour, one-line context; links to the filtered list.
- `AgentCard`: avatar, name, last seen, state, current task.
- `ReportCard`: status, project, kind, time; title; two-line summary; a **mini preview** drawn as static SVG from the first Plotly trace (line, bar or heatmap) or the first two metrics; footer with agent and the command it answered.
- `CommandCard`: the instruction, status, agent, project, age; buttons for Mark done / Cancel / See the result.
- `Thread` (project page): your commands as right-aligned bubbles, agent reports as cards, newest first, each with "Follow up".
- `Composer`: a `<dialog>` that is a bottom sheet on phones and a centred modal on larger screens; prefilled from wherever it was opened; Cmd/Ctrl+Enter sends; a toast confirms.

## Motion

Pulsing dot for live work, sheet slide-up for the composer, career-chart bars grow once on the portfolio. Everything stops under `prefers-reduced-motion`.

## CSS note

Component classes (`.panel`, `.btn`, `.field`, `.chip`, `.status` …) live in `@layer components` so Tailwind utilities like `hidden lg:inline-flex` can override them. After changing `globals.css`, delete `.next` before a local build; Turbopack's cache has served stale CSS before.

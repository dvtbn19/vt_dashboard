import type { SectionRole } from "./noteDoc";

/** Starting points for new notes (stored as Markdown; edited as a form in the Lab). */
export const NOTE_TEMPLATES = {
  blank: { title: "Untitled note", body: "## Notes\n" },
  working: {
    title: "Working notes",
    body: `# Working notes

## 1. The request in my own words

## 2. Questions for the stakeholder

| # | Question | Date asked | Answer |
|---|---|---|---|
| 1 | | | |

## 3. Data checks

| Check | Result | Action |
|---|---|---|
| Row counts per table | | |
| Date range of each table | | |

## 4. Decisions and assumptions

| # | Decision | Why | Effect on the result |
|---|---|---|---|
| 1 | | | |

## 5. Hypotheses

| # | Hypothesis | How I tested it | Result (true / false / not sure) |
|---|---|---|---|
| 1 | | | |

## 6. Findings

| # | Finding (with the number) | So what? | Query / file |
|---|---|---|---|
| 1 | | | |

## 7. Recommendations

## 8. Questions I expect in the presentation

| Question | My answer and evidence |
|---|---|
| | |
`,
  },
} as const;

export type NoteTemplate = keyof typeof NOTE_TEMPLATES;

/** Guidance shown above each part of a working-notes form. */
export const SECTION_HINTS: Record<SectionRole, string> = {
  request: "What is the stakeholder really asking? What decision will they make with the answer?",
  questions: "Things to clarify with the stakeholder: when you asked and what they said.",
  checks: "Row counts, date ranges, duplicates, nulls, odd values, and what you did about each.",
  decisions: "Choices you made (filters, definitions, time windows) and how they change the result.",
  hypotheses: "What you expected to see, how you tested it, and what happened.",
  findings: "One finding per row, with the number. “So what?” is what it means for the stakeholder. Link the SQL that proves it.",
  recommendations: "What should the stakeholder do? One per line, most important first.",
  qa: "Hard questions you expect, with your answer and the evidence.",
};

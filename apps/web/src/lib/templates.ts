/** Starting points for new notes. Plain Markdown; edit freely after creating. */
export const NOTE_TEMPLATES = {
  blank: { title: "Untitled note", body: "" },
  working: {
    title: "Working notes",
    body: `# Working notes

Fill this in as you work, not at the end.

## 1. The request in my own words

What is the stakeholder really asking? What decision will they make with the answer?

>

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

1.

## 8. Questions I expect in the presentation

| Question | My answer and evidence |
|---|---|
| | |
`,
  },
} as const;

export type NoteTemplate = keyof typeof NOTE_TEMPLATES;

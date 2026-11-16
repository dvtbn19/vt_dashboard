import type { Project } from "./db";

const now = new Date("2026-11-16T00:00:00Z").toISOString();

export const SEED_PROJECTS: Project[] = [
  {
    slug: "dottread",
    title: "dottread — AI-assisted English reading",
    title_vi: "dottread — Đọc tiếng Anh cùng AI",
    summary:
      "A reading platform for English learners. AI translates and explains words and sentences in context, saves every lookup, and turns them into flashcards, cloze (fill-the-gap) drills and guided paragraph writing.",
    summary_vi:
      "Nền tảng đọc sách tiếng Anh. AI dịch và giải thích từ/câu theo ngữ cảnh, lưu lại mọi lần tra và biến chúng thành flashcard, bài điền từ còn thiếu và luyện viết đoạn văn với chính những từ đã tra.",
    status: "active",
    tags: ["Next.js", "LLM", "EdTech", "Spaced repetition", "Vercel"],
    repo_url: null,
    demo_url: "https://www.dottread.com/",
    cover: null,
    progress: 70,
    is_public: true,
    created_at: now,
    updated_at: now,
  },
];

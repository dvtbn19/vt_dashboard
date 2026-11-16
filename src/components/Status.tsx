import type { Lang } from "@/lib/i18n";

const words: Record<string, { en: string; vi: string }> = {
  running: { en: "running", vi: "đang chạy" },
  claimed: { en: "in progress", vi: "đang làm" },
  pending: { en: "waiting", vi: "đang chờ" },
  active: { en: "active", vi: "đang làm" },
  done: { en: "done", vi: "xong" },
  failed: { en: "failed", vi: "lỗi" },
  cancelled: { en: "cancelled", vi: "đã huỷ" },
  paused: { en: "paused", vi: "tạm dừng" },
  idea: { en: "idea", vi: "ý tưởng" },
  draft: { en: "draft", vi: "nháp" },
};

export function StatusPill({ status, lang = "en" }: { status: string; lang?: Lang }) {
  return (
    <span className="status" data-s={status}>
      {words[status]?.[lang] ?? status}
    </span>
  );
}

export function VisibilityPill({ isPublic, labels }: { isPublic: boolean; labels: { public: string; private: string } }) {
  return (
    <span className={`text-[13px] font-medium ${isPublic ? "text-ink" : "text-pencil"}`}>
      {isPublic ? labels.public : labels.private}
    </span>
  );
}

import { cookies } from "next/headers";

export type Lang = "en" | "vi";

export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return c.get("lang")?.value === "vi" ? "vi" : "en";
}

/** Pick the localized variant of a field, falling back to English. */
export function pick(lang: Lang, en: string, vi?: string | null) {
  return lang === "vi" && vi ? vi : en;
}

const en = {
  lab: "Lab",
  hub: "Project Hub",
  portfolio: "Portfolio",
  projects: "Projects",
  feed: "Activity feed",
  inbox: "Command inbox",
  docs: "Bot API",
  login: "Owner login",
  logout: "Log out",
  password: "Password",
  signIn: "Sign in",
  noReports: "No reports yet. When an agent posts an analysis, it shows up here.",
  noDb: "No database is connected, so this shows sample data only. Connect Neon Postgres in the Vercel project to start receiving reports.",
  status: "Status",
  progress: "Progress",
  reports: "Reports",
  agents: "Agents",
  openCommands: "Open commands",
  public: "Public",
  private: "Private",
  makePublic: "Make public",
  makePrivate: "Make private",
  nextStep: "Give an agent its next task",
  nextStepHint: "e.g. Add a monthly seasonality breakdown and retrain with lr=1e-4",
  send: "Queue command",
  commands: "Commands",
  noCommands: "No commands yet.",
  agentOptional: "Agent (optional)",
  allProjects: "All projects",
  viewDemo: "Live demo",
  viewRepo: "Repository",
  back: "Back",
  updated: "Updated",
  by: "by",
  result: "Result",
  markDone: "Mark done",
  cancel: "Cancel",
  newProject: "New project",
  save: "Save",
};

export type Dict = Record<keyof typeof en, string>;

const vi: Dict = {
  lab: "Lab",
  hub: "Project Hub",
  portfolio: "Portfolio",
  projects: "Dự án",
  feed: "Hoạt động gần đây",
  inbox: "Hộp lệnh",
  docs: "API cho bot",
  login: "Đăng nhập chủ sở hữu",
  logout: "Đăng xuất",
  password: "Mật khẩu",
  signIn: "Đăng nhập",
  noReports: "Chưa có báo cáo. Các agent sẽ đăng kết quả phân tích tại đây.",
  noDb: "Chưa kết nối database — đang hiển thị dữ liệu mẫu. Hãy kết nối Neon Postgres trên Vercel để bắt đầu nhận báo cáo.",
  status: "Trạng thái",
  progress: "Tiến độ",
  reports: "Báo cáo",
  agents: "Agent",
  openCommands: "Lệnh đang chờ",
  public: "Công khai",
  private: "Riêng tư",
  makePublic: "Công khai",
  makePrivate: "Chuyển riêng tư",
  nextStep: "Giao việc tiếp cho agent",
  nextStepHint: "VD: Thêm phân tích mùa vụ theo tháng và train lại với lr=1e-4",
  send: "Gửi lệnh",
  commands: "Lệnh",
  noCommands: "Chưa có lệnh nào.",
  agentOptional: "Agent (tuỳ chọn)",
  allProjects: "Tất cả dự án",
  viewDemo: "Xem demo",
  viewRepo: "Mã nguồn",
  back: "Quay lại",
  updated: "Cập nhật",
  by: "bởi",
  result: "Kết quả",
  markDone: "Đánh dấu xong",
  cancel: "Huỷ",
  newProject: "Dự án mới",
  save: "Lưu",
};

const dict: Record<Lang, Dict> = { en, vi };

export function t(lang: Lang): Dict {
  return dict[lang];
}

export const TZ = process.env.LAB_TZ || "Australia/Sydney";

/** "14:02" in William's timezone. */
export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

function dayKey(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
}

/** "Today", "Yesterday" or "Mon 16 Nov" in William's timezone. */
export function dayLabel(iso: string, lang: Lang) {
  const d = new Date(iso);
  const k = dayKey(d);
  const today = dayKey(new Date());
  const yest = dayKey(new Date(Date.now() - 864e5));
  if (k === today) return lang === "vi" ? "Hôm nay" : "Today";
  if (k === yest) return lang === "vi" ? "Hôm qua" : "Yesterday";
  return d.toLocaleDateString(lang === "vi" ? "vi-VN" : "en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
}

export function groupByDay<T extends { created_at: string }>(items: T[], lang: Lang) {
  const groups: { label: string; items: T[] }[] = [];
  for (const it of items) {
    const label = dayLabel(it.created_at, lang);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  }
  return groups;
}

export function timeAgo(iso: string, lang: Lang) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const units: [number, string, string][] = [
    [60, "s", "giây"],
    [60, "m", "phút"],
    [24, "h", "giờ"],
    [30, "d", "ngày"],
    [12, "mo", "tháng"],
    [Infinity, "y", "năm"],
  ];
  let v = s;
  for (const [step, en, vi] of units) {
    if (v < step) return lang === "vi" ? `${v} ${vi} trước` : `${v}${en} ago`;
    v = Math.floor(v / step);
  }
  return "";
}

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
  noReports: "No reports yet. Agents will post analyses here.",
  noDb: "Database not connected yet — showing seed data. Connect Neon Postgres in Vercel to start receiving reports.",
  status: "Status",
  progress: "Progress",
  reports: "Reports",
  agents: "Agents",
  openCommands: "Open commands",
  public: "Public",
  private: "Private",
  makePublic: "Make public",
  makePrivate: "Make private",
  nextStep: "Next step for the agent",
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

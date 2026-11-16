/** Optional Telegram ping when agents post results. Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID to enable. */
export async function notifyTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
  } catch {
    // best effort only
  }
}

export function labBaseUrl(req?: Request) {
  if (process.env.LAB_PUBLIC_URL) return process.env.LAB_PUBLIC_URL.replace(/\/$/, "");
  if (req) {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  }
  return "";
}

/** Path to a lab page; on the lab.* host the /lab prefix is optional but always valid. */
export function labPath(p: string) {
  return `/lab${p}`;
}

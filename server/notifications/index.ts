export type NotificationSeverity = "info" | "warning" | "critical";

export interface NotificationMessage {
  title: string;
  body: string;
  severity?: NotificationSeverity;
  context?: Record<string, unknown>;
}

export interface NotificationDispatcher {
  notifyFailure(message: NotificationMessage): Promise<void>;
  notifyEscalation(message: NotificationMessage): Promise<void>;
}

type NotificationChannel = (message: NotificationMessage) => Promise<void>;

const emailWebhook = process.env.ETL_EMAIL_WEBHOOK;
const slackWebhook = process.env.ETL_SLACK_WEBHOOK;
const telegramBotToken = process.env.ETL_TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.ETL_TELEGRAM_CHAT_ID;

function safeStringify(data: unknown) {
  try {
    return JSON.stringify(data, null, 2);
  } catch (_error) {
    return String(data);
  }
}

async function postJson(url: string, payload: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to dispatch notification: ${res.status}`);
  }
}

async function postForm(url: string, payload: URLSearchParams) {
  const res = await fetch(url, {
    method: "POST",
    body: payload,
  });

  if (!res.ok) {
    throw new Error(`Failed to dispatch notification: ${res.status}`);
  }
}

export function createNotificationDispatcher(): NotificationDispatcher {
  const channels: NotificationChannel[] = [];

  if (emailWebhook) {
    channels.push(async (message) => {
      await postJson(emailWebhook, {
        subject: message.title,
        message: message.body,
        severity: message.severity ?? "info",
        context: message.context,
      });
    });
  }

  if (slackWebhook) {
    channels.push(async (message) => {
      await postJson(slackWebhook, {
        text: `*:rotating_light: ${message.title}*\n${message.body}`,
        attachments: message.context
          ? [
              {
                text: `\`\`\`${safeStringify(message.context)}\`\`\``,
              },
            ]
          : undefined,
      });
    });
  }

  if (telegramBotToken && telegramChatId) {
    channels.push(async (message) => {
      const contextText = message.context
        ? `\n\n${safeStringify(message.context)}`
        : "";
      const text = `*${message.title}*\n${message.body}${contextText}`;
      const payload = new URLSearchParams({
        chat_id: telegramChatId,
        parse_mode: "Markdown",
        text,
      });
      await postForm(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, payload);
    });
  }

  async function dispatch(message: NotificationMessage) {
    if (channels.length === 0) {
      const serialized = message.context ? ` :: ${safeStringify(message.context)}` : "";
      console.warn(`[notifications] ${message.title} - ${message.body}${serialized}`);
      return;
    }

    const results = await Promise.allSettled(channels.map((channel) => channel(message)));
    results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .forEach((result) => {
        console.error("Notification channel error", result.reason);
      });
  }

  return {
    notifyFailure: dispatch,
    async notifyEscalation(message) {
      await dispatch({
        severity: "critical",
        ...message,
      });
    },
  };
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // seconds
}

export interface GmailMessage {
  id: string;
  threadId: string;
}

export interface GmailMessageDetail {
  id: string;
  subject: string;
  from: string;
  date: string;
  textBody: string;
  htmlBody: string;
}

// ── OAuth2 ────────────────────────────────────────────────────────────────────

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<GmailTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<GmailTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh Google token");
  return res.json();
}

// ── Gmail API ─────────────────────────────────────────────────────────────────

// Gmail search query that matches Airbnb and Booking.com confirmation emails
const SEARCH_QUERY = [
  "from:automated@airbnb.com",
  "from:no-reply@airbnb.com",
  "from:noreply@booking.com",
  "from:customer.service@booking.com",
].join(" OR ");

export async function listNewMessages(
  accessToken: string,
  afterDate?: Date
): Promise<GmailMessage[]> {
  let q = `(${SEARCH_QUERY})`;
  if (afterDate) {
    // Gmail uses Unix epoch seconds
    q += ` after:${Math.floor(afterDate.getTime() / 1000)}`;
  }

  const url = `${GMAIL_API}/messages?${new URLSearchParams({ q, maxResults: "50" })}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail list failed: ${res.status}`);

  const data = await res.json();
  return (data.messages as GmailMessage[]) ?? [];
}

export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessageDetail> {
  const url = `${GMAIL_API}/messages/${messageId}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail get message failed: ${res.status}`);

  const msg = await res.json();
  const headers: Record<string, string> = {};
  for (const h of msg.payload?.headers ?? []) {
    headers[h.name.toLowerCase()] = h.value;
  }

  const textBody = extractPart(msg.payload, "text/plain");
  const htmlBody = extractPart(msg.payload, "text/html");

  return {
    id: msg.id,
    subject: headers["subject"] ?? "",
    from: headers["from"] ?? "",
    date: headers["date"] ?? "",
    textBody,
    htmlBody,
  };
}

function extractPart(payload: Record<string, unknown>, mimeType: string): string {
  if (!payload) return "";

  if (payload.mimeType === mimeType) {
    const data = (payload.body as Record<string, string>)?.data;
    if (data) return Buffer.from(data, "base64url").toString("utf-8");
  }

  const parts = (payload.parts as Record<string, unknown>[]) ?? [];
  for (const part of parts) {
    const found = extractPart(part as Record<string, unknown>, mimeType);
    if (found) return found;
  }

  return "";
}

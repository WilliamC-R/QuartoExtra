export interface ParsedReservation {
  hospede: string;
  checkin: string;  // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  valor: number;
  origem: "Airbnb" | "Booking";
  obs: string;
}

// Strip HTML tags to extract plain text
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Parse "15 de junho de 2026" or "15/06/2026" or "Jun 15, 2026"
function parsePortugueseDate(raw: string): string | null {
  const months: Record<string, string> = {
    janeiro: "01", fevereiro: "02", março: "03", abril: "04",
    maio: "05", junho: "06", julho: "07", agosto: "08",
    setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
    jan: "01", fev: "02", mar: "03", abr: "04",
    mai: "05", jun: "06", jul: "07", ago: "08",
    set: "09", out: "10", nov: "11", dez: "12",
  };

  // "15 de junho de 2026" or "15 junho 2026"
  const longMatch = raw.match(/(\d{1,2})\s+(?:de\s+)?([a-zç]+)\.?\s+(?:de\s+)?(\d{4})/i);
  if (longMatch) {
    const [, d, m, y] = longMatch;
    const mo = months[m.toLowerCase().replace("ç", "c").replace("á", "a").replace("ê", "e")];
    if (mo) return `${y}-${mo}-${d.padStart(2, "0")}`;
  }

  // "15/06/2026" or "15-06-2026"
  const slashMatch = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // ISO "2026-06-15"
  const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  return null;
}

function parseBrMoney(raw: string): number {
  // "R$ 1.234,56" → 1234.56
  const m = raw.match(/R?\$?\s*([\d.,]+)/);
  if (!m) return 0;
  const cleaned = m[1].replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

/*
  Airbnb sends several confirmation email types. We look for:
  - "Você tem uma nova reserva!" (host)
  - "Reserva confirmada" (host)
  - Guest name, dates, and payout

  The text body is the most reliable for parsing.
*/
export function parseAirbnbEmail(
  subject: string,
  textBody: string,
  htmlBody: string
): ParsedReservation | null {
  const body = textBody || stripHtml(htmlBody);

  // Only process reservation confirmation emails
  const isConfirmation =
    /reserva confirmada|nova reserva|reservation confirmed|new reservation/i.test(subject + body);
  if (!isConfirmation) return null;

  // ── Guest name ─────────────────────────────────────────────────────────────
  // "Hóspede: João Silva" or "Guest: João Silva"
  let hospede = "";
  const guestMatch = body.match(
    /(?:hóspede|hospede|guest|nome|h[oô]te)[:\s]+([A-ZÀ-ÖØ-öø-ÿ][a-zA-ZÀ-ÖØ-öø-ÿ\s]{2,40})/i
  );
  if (guestMatch) hospede = guestMatch[1].trim();

  // Fallback: look for name patterns near "checkin" context
  if (!hospede) {
    const nameMatch = subject.match(/–\s+(.+?)\s+[–(]/);
    if (nameMatch) hospede = nameMatch[1].trim();
  }

  // ── Dates ──────────────────────────────────────────────────────────────────
  // "Check-in: 15 de junho de 2026\nCheck-out: 18 de junho de 2026"
  const checkinMatch = body.match(
    /check[- ]?in[:\s]+([^\n\r]{5,30})/i
  );
  const checkoutMatch = body.match(
    /check[- ]?out[:\s]+([^\n\r]{5,30})/i
  );

  if (!checkinMatch || !checkoutMatch) return null;

  const checkin = parsePortugueseDate(checkinMatch[1]);
  const checkout = parsePortugueseDate(checkoutMatch[1]);

  if (!checkin || !checkout) return null;

  // ── Value (payout to host) ─────────────────────────────────────────────────
  // "Você receberá R$ 450,00" or "Valor: R$ 450,00" or "Ganhos: R$ 450,00"
  let valor = 0;
  const valueMatch = body.match(
    /(?:receberá|ganhos|payout|total|valor)[:\s]+(?:de\s+)?(R\$\s*[\d.,]+)/i
  );
  if (valueMatch) valor = parseBrMoney(valueMatch[1]);

  // Fallback: any R$ amount in the email
  if (!valor) {
    const anyMoney = body.match(/R\$\s*([\d.]+,\d{2})/);
    if (anyMoney) valor = parseBrMoney(anyMoney[0]);
  }

  return {
    hospede: hospede || "Hóspede Airbnb",
    checkin,
    checkout,
    valor,
    origem: "Airbnb",
    obs: `Email: ${subject}`.slice(0, 300),
  };
}

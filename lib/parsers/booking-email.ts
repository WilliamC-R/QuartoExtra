import type { ParsedReservation } from "./airbnb-email";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDate(raw: string): string | null {
  const months: Record<string, string> = {
    janeiro: "01", fevereiro: "02", março: "03", abril: "04",
    maio: "05", junho: "06", julho: "07", agosto: "08",
    setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
    jan: "01", fev: "02", mar: "03", abr: "04",
    mai: "05", jun: "06", jul: "07", ago: "08",
    set: "09", out: "10", nov: "11", dez: "12",
  };

  // "15 de junho de 2026"
  const longMatch = raw.match(/(\d{1,2})\s+(?:de\s+)?([a-zç]+)\.?\s+(?:de\s+)?(\d{4})/i);
  if (longMatch) {
    const [, d, m, y] = longMatch;
    const mo = months[m.toLowerCase().replace(/[çc]/g, "c").replace(/[áa]/g, "a").replace(/[êe]/g, "e")];
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

function parseMoney(raw: string): number {
  const m = raw.match(/R?\$?\s*([\d.,]+)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || 0;
}

/*
  Booking.com sends confirmation emails with formats like:
  - "Nova reserva: [Nome]"
  - "Você tem uma nova reserva de [Nome]"
  Contains: guest name, arrival/departure dates, total amount, booking number
*/
export function parseBookingEmail(
  subject: string,
  textBody: string,
  htmlBody: string
): ParsedReservation | null {
  const body = textBody || stripHtml(htmlBody);

  const isConfirmation =
    /nova reserva|reserva confirmada|new booking|reservation confirmed/i.test(subject + body);
  if (!isConfirmation) return null;

  // ── Guest name ─────────────────────────────────────────────────────────────
  // "Nova reserva: João Silva" (from subject)
  // "Hóspede: João Silva" (from body)
  let hospede = "";

  const subjectMatch = subject.match(/(?:nova reserva|reserva)[:\s–-]+(.+)/i);
  if (subjectMatch) hospede = subjectMatch[1].trim();

  if (!hospede) {
    const bodyMatch = body.match(
      /(?:hóspede|hospede|guest|nome do hóspede)[:\s]+([A-ZÀ-ÖØ-öø-ÿ][a-zA-ZÀ-ÖØ-öø-ÿ\s]{2,40})/i
    );
    if (bodyMatch) hospede = bodyMatch[1].trim();
  }

  // ── Dates ──────────────────────────────────────────────────────────────────
  // Booking uses "Chegada" / "Saída" or "Check-in" / "Check-out"
  const arrivalMatch = body.match(
    /(?:chegada|arrival|check[- ]?in)[:\s]+([^\n\r]{5,30})/i
  );
  const departureMatch = body.match(
    /(?:saída|saida|departure|check[- ]?out)[:\s]+([^\n\r]{5,30})/i
  );

  if (!arrivalMatch || !departureMatch) return null;

  const checkin = parseDate(arrivalMatch[1]);
  const checkout = parseDate(departureMatch[1]);

  if (!checkin || !checkout) return null;

  // ── Value ──────────────────────────────────────────────────────────────────
  // "Total: R$ 350,00" or "Valor total: R$ 350,00"
  let valor = 0;
  const valueMatch = body.match(
    /(?:total|valor total|commission|comissão)[:\s]+(?:de\s+)?(R\$\s*[\d.,]+)/i
  );
  if (valueMatch) valor = parseMoney(valueMatch[1]);

  if (!valor) {
    const anyMoney = body.match(/R\$\s*([\d.]+,\d{2})/);
    if (anyMoney) valor = parseMoney(anyMoney[0]);
  }

  return {
    hospede: hospede || "Hóspede Booking",
    checkin,
    checkout,
    valor,
    origem: "Booking",
    obs: `Email: ${subject}`.slice(0, 300),
  };
}

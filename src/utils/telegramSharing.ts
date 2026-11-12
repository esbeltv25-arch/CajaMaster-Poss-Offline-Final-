/**
 * Telegram Sharing & Integration Utilities for CajaMaster POS
 * Supports sharing tickets, daily Z-reports, delivery orders,
 * marketing offers, and license activations to Telegram groups, channels, and chats.
 */

import type { Sale, DailyClosing, BusinessInfo, ExchangeRates } from "../types";
import { formatCurrency } from "./currency";
import { openExternalUrl } from "./nativeBridge";

/**
 * Normalizes a Telegram username or channel identifier.
 * Strips '@', 'https://t.me/', whitespace.
 */
export function normalizeTelegramHandle(handle: string): string {
  if (!handle) return "";
  let clean = handle.trim();
  clean = clean.replace(/^https?:\/\/t\.me\//i, "");
  clean = clean.replace(/^@/, "");
  return clean;
}

/**
 * Generates standard Telegram share URL (opens Telegram app on mobile/desktop or web)
 * allowing the user to select any contact, group, or channel.
 */
export function getTelegramShareUrl(text: string, url?: string): string {
  const encodedText = encodeURIComponent(text);
  if (url) {
    const encodedUrl = encodeURIComponent(url);
    return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  }
  return `https://t.me/share/url?text=${encodedText}`;
}

/**
 * Generates direct link to message a specific user, bot, channel, or group.
 */
export function getTelegramDirectUrl(recipientHandle: string, text?: string): string {
  const clean = normalizeTelegramHandle(recipientHandle);
  if (!clean) {
    return getTelegramShareUrl(text || "");
  }
  const baseUrl = `https://t.me/${clean}`;
  if (text) {
    return `${baseUrl}?text=${encodeURIComponent(text)}`;
  }
  return baseUrl;
}


/**
 * Opens Telegram share intent in browser or native client.
 */
export function openTelegramShare(text: string, url?: string): void {
  const shareUrl = getTelegramShareUrl(text, url);
  openExternalUrl(shareUrl);
}

/**
 * Formats a sales receipt / ticket into a clean, legible Telegram message
 * formatted for Cuban commerce, groups and channels.
 */
export function generateTelegramTicketText(
  sale: Sale,
  biz: BusinessInfo,
  rates?: ExchangeRates
): string {
  const dateStr = new Date(sale.ts).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const lines: string[] = [
    `🧾 *COMPROBANTE DE VENTA*`,
    `🏢 *${biz.name || "CajaMaster POS"}*`,
  ];

  if (biz.address) lines.push(`📍 ${biz.address}`);
  if (biz.phone) lines.push(`📞 ${biz.phone}`);

  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*Ticket:* #${sale.ticketNumber || sale.id.slice(-6)}`);
  lines.push(`*Fecha:* ${dateStr}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*DETALLE DE PRODUCTOS:*`);

  sale.items.forEach((item, idx) => {
    const itemTotal = (item.qty * item.price).toFixed(2);
    lines.push(
      `${idx + 1}. *${item.name}*\n   ${item.qty} ${item.unit || "u"} x $${item.price.toFixed(2)} = *$${itemTotal} CUP*`
    );
  });

  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`💰 *TOTAL:* $${sale.total.toFixed(2)} CUP`);

  if (rates && rates.USD && rates.USD > 0) {
    const usdVal = (sale.total / rates.USD).toFixed(2);
    lines.push(`💵 Equivalente USD: ~$${usdVal}`);
  }

  lines.push(`*Método de Pago:* ${String(sale.paymentMethod).toUpperCase()}`);

  if (sale.cashPaid && sale.cashPaid > 0) {
    lines.push(`*Efectivo Entregado:* $${sale.cashPaid.toFixed(2)} CUP`);
    if (sale.change && sale.change > 0) {
      lines.push(`*Vuelto / Cambio:* $${sale.change.toFixed(2)} CUP`);
    }
  }

  if (sale.gatewayReference) {
    lines.push(`*Referencia:* ${sale.gatewayReference}`);
  }

  if (sale.notes) {
    lines.push(`*Notas:* ${sale.notes}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_${biz.footerMessage || "¡Gracias por su preferencia!"}_`);
  lines.push(`_Generado por CajaMaster POS_`);

  return lines.join("\n");
}

/**
 * Formats a Daily Z Closing report for Telegram management groups or owner chat.
 */
export function generateTelegramZReportText(
  closing: DailyClosing,
  biz: BusinessInfo,
  rates?: ExchangeRates
): string {
  const dateStr = closing.date;
  const timeStr = new Date(closing.closedAt).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const expectedCash = closing.expectedCash ?? (closing.openingCash + closing.cashSales);

  const lines: string[] = [
    `📊 *INFORME Z - CIERRE DE CAJA*`,
    `🏢 *${biz.name || "CajaMaster POS"}*`,
    `📅 *Fecha:* ${dateStr} • *Hora:* ${timeStr}`,
  ];

  if (closing.cashier || biz.owner) {
    lines.push(`👤 *Responsable:* ${closing.cashier || biz.owner}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*RESUMEN FINANCIERO:*`);
  lines.push(`• *Fondo Inicial de Caja:* $${closing.openingCash.toFixed(2)} CUP`);
  lines.push(`• *Ventas en Efectivo:* $${closing.cashSales.toFixed(2)} CUP`);
  lines.push(`• *Ventas por Transferencia:* $${closing.transferSales.toFixed(2)} CUP`);
  lines.push(`• 💵 *VENTAS TOTALES DEL DÍA:* $${closing.totalSales.toFixed(2)} CUP`);
  lines.push(`• 🧾 *Tickets Emitidos:* ${closing.totalTickets}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🎯 *Efectivo Esperado (Teórico):* $${expectedCash.toFixed(2)} CUP`);
  lines.push(`💵 *Efectivo Real Contado:* $${closing.countedCash.toFixed(2)} CUP`);

  const diff = closing.cashDiscrepancy;
  if (Math.abs(diff) < 0.01) {
    lines.push(`🟢 *CUADRE EXACTO:* $0.00 CUP`);
  } else if (diff > 0) {
    lines.push(`🟡 *SOBRANTE DE CAJA:* +$${diff.toFixed(2)} CUP`);
  } else {
    lines.push(`🔴 *FALTANTE DE CAJA:* -$${Math.abs(diff).toFixed(2)} CUP`);
  }

  if (closing.billCounts && Object.keys(closing.billCounts).length > 0) {
    const activeBills = Object.entries(closing.billCounts)
      .map(([val, cnt]) => ({ value: Number(val), count: Number(cnt) }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.value - a.value);

    if (activeBills.length > 0) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`💵 *DESGLOSE DE BILLETES (CUP):*`);
      activeBills.forEach((b) => {
        const sub = b.count * b.value;
        const tag = b.value >= 10000 ? " *(Nuevo)*" : "";
        lines.push(`• ${b.count}x $${b.value.toLocaleString("es-ES")}${tag} = $${sub.toLocaleString("es-ES")} CUP`);
      });
    }
  }

  if (closing.notes) {
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📝 *Observaciones:* ${closing.notes}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Reporte certificado y auditado por CajaMaster POS_`);

  return lines.join("\n");
}

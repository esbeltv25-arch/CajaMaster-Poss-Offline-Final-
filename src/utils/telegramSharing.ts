/**
 * Telegram Sharing & Integration Utilities for CajaMaster POS
 * Supports sharing tickets, daily Z-reports, delivery orders,
 * marketing offers, and license activations to Telegram groups, channels, and chats.
 */

import type { Sale, DailyClosing, BusinessInfo, ExchangeRates } from "../types";
import { formatCurrency, cashByCurrencyLines } from "./currency";
import { openTelegramWithText } from "./nativeBridge";

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
  void openTelegramWithText(url ? `${text}\n${url}` : text);
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

  // Amounts in the currency the sale was charged in
  const saleCur = (sale as any).currency || "CUP";
  const saleRates: ExchangeRates | undefined =
    saleCur !== "CUP" && (sale as any).exchangeRate
      ? ({ ...(rates || {}), [saleCur]: (sale as any).exchangeRate } as ExchangeRates)
      : rates;
  const m = (v: number) => formatCurrency(v, saleCur, saleRates);

  sale.items.forEach((item, idx) => {
    lines.push(
      `${idx + 1}. *${item.name}*\n   ${item.qty} ${item.unit || "u"} x ${m(item.price)} = *${m(item.qty * item.price)}*`
    );
  });

  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`💰 *TOTAL:* ${m(sale.total)}`);

  if (saleCur !== "CUP") {
    lines.push(`💵 Equivalente: ~${formatCurrency(sale.total, "CUP", saleRates)}`);
  } else if (rates && rates.USD && rates.USD > 0) {
    lines.push(`💵 Equivalente: ~${formatCurrency(sale.total, "USD", rates)}`);
  }

  lines.push(`*Método de Pago:* ${String(sale.paymentMethod).toUpperCase()}`);

  if (sale.cashPaid && sale.cashPaid > 0) {
    lines.push(`*Efectivo Entregado:* ${m(sale.cashPaid)}`);
    if (sale.change && sale.change > 0) {
      lines.push(`*Vuelto / Cambio:* ${m(sale.change)}`);
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
  lines.push(`• *Fondo Inicial de Caja:* CUP ${closing.openingCash.toFixed(2)}`);
  lines.push(`• *Ventas en Efectivo:* CUP ${closing.cashSales.toFixed(2)}`);
  lines.push(`• *Ventas por Transferencia:* CUP ${closing.transferSales.toFixed(2)}`);
  lines.push(`• 💵 *VENTAS TOTALES DEL DÍA:* CUP ${closing.totalSales.toFixed(2)}`);
  lines.push(`• 🧾 *Tickets Emitidos:* ${closing.totalTickets}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🎯 *Efectivo Esperado (Teórico):* CUP ${expectedCash.toFixed(2)}`);
  lines.push(`💵 *Efectivo Real Contado:* CUP ${closing.countedCash.toFixed(2)}`);
  cashByCurrencyLines(closing.cashByCurrency).forEach((l) => lines.push(`   ◦ ${l}`));

  const diff = closing.cashDiscrepancy;
  if (Math.abs(diff) < 0.01) {
    lines.push(`🟢 *CUADRE EXACTO:* $0.00 CUP`);
  } else if (diff > 0) {
    lines.push(`🟡 *SOBRANTE DE CAJA:* +CUP ${diff.toFixed(2)}`);
  } else {
    lines.push(`🔴 *FALTANTE DE CAJA:* -CUP ${Math.abs(diff).toFixed(2)}`);
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
        lines.push(`• ${b.count}x ${b.value.toLocaleString("es-ES")} CUP${tag} = CUP ${sub.toLocaleString("es-ES")}`);
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

import type {
  PrinterDevice,
  PrinterSettings,
  PrinterConnectionType,
  PrinterPaperWidth,
  Sale,
  DailyClosing,
  BusinessInfo,
  ExchangeRates,
} from "../types";
import { formatCurrency } from "../utils/currency";

const PRINTER_STORAGE_KEY = "cajamaster_printer_config_v2";

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  defaultPrinterId: "system-default",
  printers: [
    {
      id: "system-default",
      name: "Impresora del Sistema / Diálogo Predeterminado",
      connectionType: "system",
      paperWidth: "58mm",
      autoCut: true,
      openCashDrawer: false,
      isDefault: true,
      createdAt: Date.now(),
    },
  ],
  autoOpenSelectorIfNoDefault: true,
  autoPrintOnFinishSale: false,
  headerGraphicOrEmoji: true,
  lineFeedCount: 4,
};

// ==========================================
// PERSISTENCE & CRUD
// ==========================================

export function getPrinterSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.printers)) {
        return {
          ...DEFAULT_PRINTER_SETTINGS,
          ...parsed,
        };
      }
    }
  } catch (err) {
    console.warn("Error loading printer settings:", err);
  }
  return DEFAULT_PRINTER_SETTINGS;
}

export function savePrinterSettings(settings: PrinterSettings): void {
  try {
    localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Error saving printer settings:", err);
  }
}

export function getDefaultPrinter(): PrinterDevice | null {
  const settings = getPrinterSettings();
  if (settings.defaultPrinterId) {
    const found = settings.printers.find((p) => p.id === settings.defaultPrinterId);
    if (found) return found;
  }
  return settings.printers.length > 0 ? settings.printers[0] : null;
}

export function savePrinterDevice(printer: PrinterDevice): PrinterSettings {
  const settings = getPrinterSettings();
  const existingIndex = settings.printers.findIndex((p) => p.id === printer.id);

  let updatedPrinters = [...settings.printers];
  if (existingIndex >= 0) {
    updatedPrinters[existingIndex] = printer;
  } else {
    updatedPrinters.push(printer);
  }

  let defaultId = settings.defaultPrinterId;
  if (printer.isDefault || updatedPrinters.length === 1) {
    defaultId = printer.id;
    updatedPrinters = updatedPrinters.map((p) => ({
      ...p,
      isDefault: p.id === printer.id,
    }));
  }

  const newSettings: PrinterSettings = {
    ...settings,
    defaultPrinterId: defaultId,
    printers: updatedPrinters,
  };

  savePrinterSettings(newSettings);
  return newSettings;
}

export function deletePrinterDevice(id: string): PrinterSettings {
  const settings = getPrinterSettings();
  const updatedPrinters = settings.printers.filter((p) => p.id !== id);

  let defaultId = settings.defaultPrinterId;
  if (defaultId === id) {
    defaultId = updatedPrinters.length > 0 ? updatedPrinters[0].id : null;
    if (defaultId) {
      const idx = updatedPrinters.findIndex((p) => p.id === defaultId);
      if (idx >= 0) updatedPrinters[idx].isDefault = true;
    }
  }

  const newSettings: PrinterSettings = {
    ...settings,
    defaultPrinterId: defaultId,
    printers: updatedPrinters,
  };

  savePrinterSettings(newSettings);
  return newSettings;
}

export function setDefaultPrinterId(id: string): PrinterSettings {
  const settings = getPrinterSettings();
  const updatedPrinters = settings.printers.map((p) => ({
    ...p,
    isDefault: p.id === id,
  }));

  const newSettings: PrinterSettings = {
    ...settings,
    defaultPrinterId: id,
    printers: updatedPrinters,
  };

  savePrinterSettings(newSettings);
  return newSettings;
}

// ==========================================
// TEXT & RECEIPT FORMATTING HELPERS
// ==========================================

export function getLineWidth(width: PrinterPaperWidth): number {
  return width === "80mm" ? 48 : 32;
}

export function padLine(left: string, right: string, totalWidth: number): string {
  const leftLen = left.length;
  const rightLen = right.length;
  if (leftLen + rightLen >= totalWidth) {
    const available = totalWidth - rightLen - 1;
    if (available > 3) {
      const truncated = left.slice(0, available);
      return truncated + " " + right;
    }
    return left + "\n" + "".padStart(totalWidth - rightLen) + right;
  }
  const spaces = totalWidth - leftLen - rightLen;
  return left + " ".repeat(spaces) + right;
}

export function centerText(text: string, totalWidth: number): string {
  if (text.length >= totalWidth) return text.slice(0, totalWidth);
  const leftPad = Math.floor((totalWidth - text.length) / 2);
  return " ".repeat(leftPad) + text;
}

export function divider(char = "-", totalWidth: number): string {
  return char.repeat(totalWidth);
}

// ==========================================
// ESC/POS COMMAND GENERATOR (BINARY)
// ==========================================

export class EscPosEncoder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  init(): this {
    this.buffer.push(0x1b, 0x40); // ESC @ (Initialize)
    return this;
  }

  alignCenter(): this {
    this.buffer.push(0x1b, 0x61, 0x01); // ESC a 1
    return this;
  }

  alignLeft(): this {
    this.buffer.push(0x1b, 0x61, 0x00); // ESC a 0
    return this;
  }

  alignRight(): this {
    this.buffer.push(0x1b, 0x61, 0x02); // ESC a 2
    return this;
  }

  bold(enable = true): this {
    this.buffer.push(0x1b, 0x45, enable ? 0x01 : 0x00); // ESC E n
    return this;
  }

  doubleSize(enable = true): this {
    this.buffer.push(0x1b, 0x21, enable ? 0x30 : 0x00); // ESC ! n
    return this;
  }

  text(str: string): this {
    // Convert string to latin1 / CP437 byte values
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 128) {
        this.buffer.push(code);
      } else {
        // Simple map for common Spanish characters in CP437/CP850
        switch (str[i]) {
          case "á": this.buffer.push(0xa0); break;
          case "é": this.buffer.push(0x82); break;
          case "í": this.buffer.push(0xa1); break;
          case "ó": this.buffer.push(0xa2); break;
          case "ú": this.buffer.push(0xa3); break;
          case "ñ": this.buffer.push(0xa4); break;
          case "Ñ": this.buffer.push(0xa5); break;
          case "Á": this.buffer.push(0x41); break;
          case "É": this.buffer.push(0x45); break;
          case "Í": this.buffer.push(0x49); break;
          case "Ó": this.buffer.push(0x4f); break;
          case "Ú": this.buffer.push(0x55); break;
          case "ü": this.buffer.push(0x81); break;
          case "¿": this.buffer.push(0xa8); break;
          case "¡": this.buffer.push(0xad); break;
          default: this.buffer.push(0x3f); // '?'
        }
      }
    }
    return this;
  }

  line(str = ""): this {
    this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  feed(count = 3): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  cut(): this {
    this.buffer.push(0x1d, 0x56, 0x42, 0x00); // GS V 66 0
    return this;
  }

  openDrawer(): this {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa); // ESC p 0 25 250
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

// ==========================================
// TICKET BUILDERS
// ==========================================

export function buildSaleReceiptText(
  sale: Sale,
  biz: BusinessInfo,
  rates: ExchangeRates,
  width: PrinterPaperWidth = "58mm"
): string {
  const cols = getLineWidth(width);
  const lines: string[] = [];

  lines.push(centerText(biz.name || "CAJAMASTER POS", cols));
  if (biz.headerSubtitle) {
    lines.push(centerText(biz.headerSubtitle, cols));
  }
  if (biz.address) {
    lines.push(centerText(biz.address, cols));
  }
  if (biz.phone) {
    lines.push(centerText(`Tel: ${biz.phone}`, cols));
  }
  if (biz.taxId) {
    lines.push(centerText(`NIT/Doc: ${biz.taxId}`, cols));
  }

  lines.push(divider("=", cols));
  const ticketNum = sale.ticketNumber || String(sale.id).slice(-4);
  lines.push(padLine(`TICKET #${ticketNum}`, new Date(sale.ts).toLocaleDateString("es-ES"), cols));
  lines.push(padLine("HORA:", new Date(sale.ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }), cols));
  lines.push(divider("-", cols));

  // Table header
  lines.push(padLine("CANT DESCRIPCION", "IMPORTE", cols));
  lines.push(divider("-", cols));

  // Items
  sale.items.forEach((item) => {
    const qtyStr = `${item.qty}${item.unit ? " " + item.unit : ""}`;
    const nameStr = `${qtyStr} x ${item.name}`;
    const priceStr = formatCurrency(item.qty * item.price, "CUP", rates);
    lines.push(padLine(nameStr, priceStr, cols));
  });

  lines.push(divider("-", cols));

  if (sale.discount > 0) {
    lines.push(padLine("SUBTOTAL:", formatCurrency(sale.subtotal || sale.total + sale.discount, "CUP", rates), cols));
    lines.push(padLine("DESCUENTO:", `-${formatCurrency(sale.discount, "CUP", rates)}`, cols));
  }

  lines.push(padLine("TOTAL A PAGAR:", formatCurrency(sale.total, "CUP", rates), cols));

  // Payment details
  lines.push(divider(".", cols));
  const methodLabel =
    sale.paymentMethod === "cash"
      ? "EFECTIVO"
      : sale.paymentMethod === "transfermovil"
      ? "TRANSFERMÓVIL"
      : sale.paymentMethod === "enzona"
      ? "ENZONA"
      : sale.paymentMethod === "transfer"
      ? "TRANSFERENCIA"
      : "MIXTO";
  lines.push(padLine("METODO DE PAGO:", methodLabel, cols));

  if (sale.cashPaid && sale.cashPaid > 0) {
    lines.push(padLine("ENTREGADO:", formatCurrency(sale.cashPaid, "CUP", rates), cols));
    if (sale.change !== undefined && sale.change >= 0) {
      lines.push(padLine("CAMBIO / VUELTO:", formatCurrency(sale.change, "CUP", rates), cols));
    }
  }

  if (sale.gatewayReference) {
    lines.push(padLine("TRANSACCION / REF:", sale.gatewayReference, cols));
  }

  lines.push(divider("=", cols));
  lines.push(centerText(biz.footerMessage || "¡Gracias por su compra!", cols));
  lines.push(centerText("CajaMaster Pro POS", cols));
  lines.push("");

  return lines.join("\n");
}

export function buildZReportText(
  closing: DailyClosing,
  biz: BusinessInfo,
  rates: ExchangeRates,
  width: PrinterPaperWidth = "58mm"
): string {
  const cols = getLineWidth(width);
  const lines: string[] = [];

  lines.push(centerText(biz.name || "CAJAMASTER POS", cols));
  lines.push(centerText("*** CIERRE DE CAJA (INFORME Z) ***", cols));
  lines.push(divider("=", cols));
  lines.push(padLine("FECHA:", closing.date, cols));
  lines.push(padLine("HORA CIERRE:", new Date(closing.closedAt).toLocaleTimeString("es-ES"), cols));
  if (biz.owner) {
    lines.push(padLine("RESPONSABLE:", biz.owner, cols));
  }
  lines.push(divider("-", cols));

  lines.push(padLine("TOTAL TICKETS:", String(closing.totalTickets), cols));
  lines.push(padLine("FONDO APERTURA:", formatCurrency(closing.openingCash, "CUP", rates), cols));
  lines.push(padLine("VENTAS EFECTIVO:", formatCurrency(closing.cashSales, "CUP", rates), cols));
  lines.push(padLine("VENTAS TRANSFER.:", formatCurrency(closing.transferSales, "CUP", rates), cols));
  lines.push(divider("-", cols));
  lines.push(padLine("TOTAL RECAUDADO:", formatCurrency(closing.totalSales, "CUP", rates), cols));
  lines.push(divider("=", cols));

  lines.push(padLine("EFECTIVO EN CAJA:", formatCurrency(closing.countedCash, "CUP", rates), cols));
  const diff = closing.cashDiscrepancy;
  const diffLabel = diff === 0 ? "CUADRADO (0.00)" : diff > 0 ? `SOBRANTE (+${diff})` : `FALTANTE (${diff})`;
  lines.push(padLine("DIFERENCIA:", diffLabel, cols));

  lines.push(divider("-", cols));
  lines.push(padLine("ITEMS INVENTARIO:", String(closing.inventoryUnitsCounted), cols));
  lines.push(padLine("VALOR STOCK TIENDA:", formatCurrency(closing.inventoryTotalValue, "CUP", rates), cols));

  if (closing.notes) {
    lines.push(divider(".", cols));
    lines.push(`OBSERVACIONES:\n${closing.notes}`);
  }

  lines.push(divider("-", cols));
  lines.push("");
  lines.push(centerText("____________________________", cols));
  lines.push(centerText("FIRMA CONFORME / RESPONSABLE", cols));
  lines.push("");

  return lines.join("\n");
}

export function buildIPVEText(
  rows: any[],
  totals: any,
  periodLabel: string,
  biz: BusinessInfo,
  rates: ExchangeRates,
  width: PrinterPaperWidth = "80mm"
): string {
  const cols = getLineWidth(width);
  const lines: string[] = [];

  lines.push(centerText(biz.name || "ESTABLECIMIENTO COMERCIAL", cols));
  lines.push(centerText("CONTROL DE MERCANCIA - IPVE", cols));
  lines.push(centerText(`Periodo: ${periodLabel}`, cols));
  lines.push(divider("=", cols));

  lines.push(padLine("PROD / U.M", "VEND / IMPORTE", cols));
  lines.push(divider("-", cols));

  rows.forEach((r) => {
    const pName = `${r.name} (${r.unit})`;
    const stats = `${r.vendidoCant} vend. = ${formatCurrency(r.importeVendido, "CUP", rates)}`;
    lines.push(padLine(pName, stats, cols));
  });

  lines.push(divider("=", cols));
  lines.push(padLine("TOTAL UNIDADES:", String(totals.vendidoCant), cols));
  lines.push(padLine("IMPORTE VENTAS:", formatCurrency(totals.importeVendido, "CUP", rates), cols));
  lines.push(padLine("COSTO TOTAL:", formatCurrency(totals.costoTotal, "CUP", rates), cols));
  const profit = totals.importeVendido - totals.costoTotal;
  lines.push(padLine("UTILIDAD BRUTA:", formatCurrency(profit, "CUP", rates), cols));
  lines.push(divider("-", cols));
  lines.push(padLine("VALOR STOCK FINAL:", formatCurrency(totals.invFinalValor, "CUP", rates), cols));
  lines.push("");
  lines.push(centerText("CONTROL OFICIAL DE EXISTENCIAS", cols));
  lines.push("");

  return lines.join("\n");
}

// ==========================================
// HARDWARE DISCOVERY & BLUETOOTH / USB SCANNERS
// ==========================================

export async function scanBluetoothPrinter(): Promise<{
  device: any;
  name: string;
  id: string;
} | null> {
  if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
    throw new Error(
      "Web Bluetooth no está soportado en este navegador. Utiliza Google Chrome en Android/Windows/Mac o selecciona la opción Sistema/Wi-Fi."
    );
  }

  try {
    const navBt = (navigator as any).bluetooth;
    const device = await navBt.requestDevice({
      filters: [
        { services: ["000018f0-0000-1000-8000-00805f9b34fb"] }, // Common ESC/POS service
        { services: ["e7810a06-7326-427f-a013-eab4231b0250"] },
        { services: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"] },
        { namePrefix: "POS" },
        { namePrefix: "Printer" },
        { namePrefix: "MTP" },
        { namePrefix: "RPP" },
        { namePrefix: "MPT" },
        { namePrefix: "XP" },
        { namePrefix: "GOOJPRT" },
        { namePrefix: "Epson" },
        { namePrefix: "InnerPrinter" },
      ],
      optionalServices: [
        "000018f0-0000-1000-8000-00805f9b34fb",
        "e7810a06-7326-427f-a013-eab4231b0250",
        "49535343-fe7d-4ae5-8fa9-9fafd205e455",
        "0000ffe0-0000-1000-8000-00805f9b34fb",
        "000018f0-0000-1000-8000-00805f9b34fb",
      ],
    });

    return {
      device,
      name: device.name || "Impresora Bluetooth POS",
      id: `bt_${device.id || Date.now()}`,
    };
  } catch (err: any) {
    if (err.name === "NotFoundError" || err.message?.includes("User cancelled")) {
      return null; // User simply closed the picker
    }
    throw err;
  }
}

export async function scanUsbPrinter(): Promise<{
  device: any;
  name: string;
  id: string;
} | null> {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new Error(
      "WebUSB no está soportado en este navegador. Asegúrate de usar Chrome / Edge y permitir el acceso a dispositivos USB."
    );
  }

  try {
    const navUsb = (navigator as any).usb;
    const device = await navUsb.requestDevice({
      filters: [
        { classCode: 0x07 }, // USB Printer Class
      ],
    });

    return {
      device,
      name: device.productName || device.manufacturerName || "Impresora USB POS",
      id: `usb_${device.vendorId}_${device.productId}_${Date.now()}`,
    };
  } catch (err: any) {
    if (err.name === "NotFoundError" || err.message?.includes("User cancelled")) {
      return null;
    }
    throw err;
  }
}

// ==========================================
// UNIFIED PRINT EXECUTION ENGINE
// ==========================================

export async function sendEscPosToBluetooth(printer: PrinterDevice, data: Uint8Array): Promise<boolean> {
  if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
    throw new Error("Web Bluetooth no disponible.");
  }

  // Attempt GATT connection
  const navBt = (navigator as any).bluetooth;
  const device = await navBt.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      "000018f0-0000-1000-8000-00805f9b34fb",
      "e7810a06-7326-427f-a013-eab4231b0250",
      "0000ffe0-0000-1000-8000-00805f9b34fb",
    ],
  });

  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();

  let targetChar: any = null;
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const char of chars) {
      if (char.properties.write || char.properties.writeWithoutResponse) {
        targetChar = char;
        break;
      }
    }
    if (targetChar) break;
  }

  if (!targetChar) {
    throw new Error("No se encontró canal de escritura ESC/POS en el dispositivo Bluetooth seleccionado.");
  }

  // Chunk write in slices of 128 bytes to prevent BT buffer overflow
  const chunkSize = 128;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (targetChar.properties.writeWithoutResponse) {
      await targetChar.writeValueWithoutResponse(chunk);
    } else {
      await targetChar.writeValue(chunk);
    }
  }

  return true;
}

export async function sendToNetworkPrinter(printer: PrinterDevice, textData: string): Promise<boolean> {
  if (!printer.ipAddress) {
    throw new Error("La impresora de red no tiene una dirección IP configurada.");
  }

  // In standard browser environment, direct raw TCP to port 9100 is typically done via local HTTP gateway/proxy
  // We make a fetch call to potential local printer bridge or raw endpoint
  const targetUrl = `http://${printer.ipAddress}:${printer.port || 9100}/print`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(targetUrl, {
      method: "POST",
      body: textData,
      headers: { "Content-Type": "text/plain" },
      signal: controller.signal,
      mode: "no-cors", // Allow sending to local LAN even if CORS headers are absent
    });
    clearTimeout(timeout);
    return true;
  } catch (err) {
    console.warn("Direct network print endpoint error:", err);
    // Fall back to system print if direct socket fails
    return false;
  }
}

/**
 * Fallback / Standard System Print Dialog with Thermal Receipt CSS styling
 */
export function triggerSystemPrint(contentHtmlOrText: string, width: PrinterPaperWidth = "58mm"): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Create hidden dedicated print iframe to avoid messing up main DOM
      let iframe = document.getElementById("thermal-print-frame") as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "thermal-print-frame";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);
      }

      const paperWidthPx = width === "80mm" ? "300px" : "210px";
      const paperWidthMm = width === "80mm" ? "80mm" : "58mm";

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Impresión de Ticket</title>
          <style>
            @page {
              size: ${paperWidthMm} auto;
              margin: 0;
            }
            @media print {
              body {
                margin: 0;
                padding: 4px;
                width: ${paperWidthMm};
                font-family: 'Courier New', Courier, monospace, monospace;
                font-size: 11px;
                line-height: 1.25;
                color: #000;
                background: #fff;
              }
              pre {
                margin: 0;
                font-family: inherit;
                font-size: inherit;
                white-space: pre-wrap;
                word-break: break-all;
              }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              line-height: 1.25;
              padding: 6px;
              width: ${paperWidthPx};
              margin: 0 auto;
            }
            pre {
              margin: 0;
              font-family: inherit;
              font-size: inherit;
              white-space: pre-wrap;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <pre>${contentHtmlOrText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </body>
        </html>
      `;

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();

        setTimeout(() => {
          try {
            iframe?.contentWindow?.focus();
            iframe?.contentWindow?.print();
            resolve(true);
          } catch (e) {
            window.print();
            resolve(true);
          }
        }, 250);
      } else {
        window.print();
        resolve(true);
      }
    } catch (e) {
      console.warn("Print error, using window.print fallback:", e);
      window.print();
      resolve(true);
    }
  });
}

// ==========================================
// HIGH-LEVEL PRINT ACTIONS
// ==========================================

export async function executePrint(
  text: string,
  printer?: PrinterDevice | null
): Promise<{ success: boolean; message: string; methodUsed: string }> {
  const targetPrinter = printer || getDefaultPrinter() || DEFAULT_PRINTER_SETTINGS.printers[0];
  const width = targetPrinter?.paperWidth || "58mm";

  // 1. Bluetooth Connection
  if (targetPrinter.connectionType === "bluetooth") {
    try {
      const encoder = new EscPosEncoder();
      encoder.init();
      if (targetPrinter.openCashDrawer) encoder.openDrawer();
      encoder.text(text);
      encoder.feed(targetPrinter.paperWidth === "80mm" ? 4 : 3);
      if (targetPrinter.autoCut) encoder.cut();

      const rawBytes = encoder.encode();
      await sendEscPosToBluetooth(targetPrinter, rawBytes);
      return {
        success: true,
        message: `Enviado exitosamente a "${targetPrinter.name}" vía Bluetooth.`,
        methodUsed: "bluetooth",
      };
    } catch (err: any) {
      console.warn("Bluetooth print failed, falling back to system print:", err);
      await triggerSystemPrint(text, width);
      return {
        success: true,
        message: `No se pudo conectar directo a Bluetooth (${err.message || "Error"}). Se abrió el diálogo de impresión del sistema.`,
        methodUsed: "system_fallback",
      };
    }
  }

  // 2. Wi-Fi / Ethernet Network Connection
  if (targetPrinter.connectionType === "wifi" || targetPrinter.connectionType === "ethernet") {
    try {
      const sent = await sendToNetworkPrinter(targetPrinter, text);
      if (sent) {
        return {
          success: true,
          message: `Ticket enviado a la IP ${targetPrinter.ipAddress}:${targetPrinter.port || 9100}.`,
          methodUsed: targetPrinter.connectionType,
        };
      }
    } catch (e) {}

    // If network socket wasn't reached, open system dialog
    await triggerSystemPrint(text, width);
    return {
      success: true,
      message: `Enviado al diálogo de impresión para ${targetPrinter.name}.`,
      methodUsed: "system",
    };
  }

  // 3. USB / System Default Connection
  await triggerSystemPrint(text, width);
  return {
    success: true,
    message: `Diálogo de impresión activado para "${targetPrinter.name}".`,
    methodUsed: "system",
  };
}

export async function printSaleTicket(
  sale: Sale,
  biz: BusinessInfo,
  rates: ExchangeRates,
  printer?: PrinterDevice | null
): Promise<{ success: boolean; message: string; methodUsed: string }> {
  const targetPrinter = printer || getDefaultPrinter() || DEFAULT_PRINTER_SETTINGS.printers[0];
  const text = buildSaleReceiptText(sale, biz, rates, targetPrinter.paperWidth);
  return executePrint(text, targetPrinter);
}

export async function printZReportTicket(
  closing: DailyClosing,
  biz: BusinessInfo,
  rates: ExchangeRates,
  printer?: PrinterDevice | null
): Promise<{ success: boolean; message: string; methodUsed: string }> {
  const targetPrinter = printer || getDefaultPrinter() || DEFAULT_PRINTER_SETTINGS.printers[0];
  const text = buildZReportText(closing, biz, rates, targetPrinter.paperWidth);
  return executePrint(text, targetPrinter);
}

export async function printIPVEReportTicket(
  rows: any[],
  totals: any,
  periodLabel: string,
  biz: BusinessInfo,
  rates: ExchangeRates,
  printer?: PrinterDevice | null
): Promise<{ success: boolean; message: string; methodUsed: string }> {
  const targetPrinter = printer || getDefaultPrinter() || DEFAULT_PRINTER_SETTINGS.printers[0];
  const text = buildIPVEText(rows, totals, periodLabel, biz, rates, targetPrinter.paperWidth);
  return executePrint(text, targetPrinter);
}

export async function printTestTicket(
  printer?: PrinterDevice | null,
  biz?: BusinessInfo,
  rates?: ExchangeRates
): Promise<{ success: boolean; message: string }> {
  const targetPrinter = printer || getDefaultPrinter() || DEFAULT_PRINTER_SETTINGS.printers[0];
  const targetBiz = biz || { name: "CAJAMASTER POS", owner: "", address: "", phone: "", rates: { CUP: 1, USD: 320, EUR: 350, MLC: 280 } };
  const targetRates: ExchangeRates = rates || { CUP: 1, USD: 320, EUR: 350, MLC: 280 };

  const cols = getLineWidth(targetPrinter.paperWidth);
  const lines: string[] = [];

  lines.push(centerText("================================", cols));
  lines.push(centerText(targetBiz.name || "CAJAMASTER POS", cols));
  lines.push(centerText("*** PRUEBA DE IMPRESION ***", cols));
  lines.push(centerText("================================", cols));
  lines.push(padLine("CONEXION:", targetPrinter.connectionType.toUpperCase(), cols));
  lines.push(padLine("ANCHO PAPEL:", targetPrinter.paperWidth, cols));
  lines.push(padLine("DISPOSITIVO:", targetPrinter.name, cols));
  if (targetPrinter.ipAddress) {
    lines.push(padLine("IP:", `${targetPrinter.ipAddress}:${targetPrinter.port || 9100}`, cols));
  }
  lines.push(padLine("FECHA:", new Date().toLocaleDateString("es-ES"), cols));
  lines.push(padLine("HORA:", new Date().toLocaleTimeString("es-ES"), cols));
  lines.push(divider("-", cols));
  lines.push(centerText("Caracteres de prueba:", cols));
  lines.push("0123456789 ABCDEFGHIJKLMNOP");
  lines.push("abcdefghijklmnopqrstuvwxyz");
  lines.push("¡ñÑáéíóúÁÉÍÓÚ¿ - $ # % & *");
  lines.push(divider("-", cols));
  lines.push(padLine("TOTAL DE PRUEBA:", formatCurrency(1250, "CUP", targetRates), cols));
  lines.push(divider("=", cols));
  lines.push(centerText("¡Impresora configurada con exito!", cols));
  lines.push(centerText("CajaMaster Pro POS v2.5", cols));
  lines.push("");

  const res = await executePrint(lines.join("\n"), targetPrinter);
  return { success: res.success, message: res.message };
}

import type {
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryStatus,
  DeliveryDriver,
  DeliveryAgency,
  Product,
  ExchangeRates,
  PaymentMethod,
  PaymentStatus,
} from "../types";
import { formatCurrency } from "./currency";

/**
 * Normalizes phone numbers for WhatsApp URL (handles international codes +1, +34, +52, etc. and +53 for Cuba)
 */
export function formatWhatsAppPhone(phone: string): string {
  if (!phone) return "";
  const clean = phone.trim();
  const digits = clean.replace(/\D/g, "");
  if (!digits) return "";

  // If already starts with '+', keep country code digits
  if (clean.startsWith("+")) {
    return digits;
  }

  // Standard Cuban mobile: 8 digits starting with 5 (e.g. 52123456 -> 5352123456)
  if (digits.length === 8 && (digits.startsWith("5") || digits.startsWith("6") || digits.startsWith("7"))) {
    return `53${digits}`;
  }
  // Cuban mobile with 53 already: 10 digits starting with 535
  if (digits.length === 10 && digits.startsWith("535")) {
    return digits;
  }
  // If starts with 00 (e.g. 0053, 001, 0034)
  if (digits.startsWith("00") && digits.length >= 10) {
    return digits.substring(2);
  }
  // 10 digits US/North America without + (e.g. 7865551234 -> 17865551234 or keep 10)
  if (digits.length === 10 && (digits.startsWith("1") || digits.startsWith("7") || digits.startsWith("3") || digits.startsWith("8") || digits.startsWith("9"))) {
    return digits;
  }

  return digits;
}

/**
 * Generates direct WhatsApp click-to-chat URL
 */
export function getWhatsAppChatUrl(phone: string, text?: string): string {
  const normalized = formatWhatsAppPhone(phone);
  if (!normalized) return "";
  const encoded = text ? encodeURIComponent(text) : "";
  return `https://wa.me/${normalized}${encoded ? `?text=${encoded}` : ""}`;
}

/**
 * Generates customer notification messages for WhatsApp
 */
export function generateWhatsAppMessage(
  order: DeliveryOrder,
  type: "ORDER_CONFIRMATION" | "IN_ROUTE" | "DELIVERED" | "BILL_SUMMARY" | "CUSTOM",
  businessName: string = "Nuestro Negocio",
  rates?: ExchangeRates,
  driver?: DeliveryDriver,
  agency?: DeliveryAgency
): string {
  const totalStr = formatCurrency(order.total, "CUP", rates || { CUP: 1, USD: 350, EUR: 370, MLC: 300 });
  const itemsList = order.items
    .map((it) => `• ${it.qty}x ${it.name} (${formatCurrency(it.qty * it.price, "CUP", rates)})`)
    .join("\n");

  switch (type) {
    case "ORDER_CONFIRMATION":
      return `👋 *¡Hola ${order.customerName || "Cliente"}!*

Tu pedido *#${order.orderNumber}* de *${businessName}* ha sido recibido y está *en preparación* 🍳.

📦 *Detalle del Pedido:*
${itemsList}

🛵 *Costo de Envío:* ${formatCurrency(order.deliveryFee, "CUP", rates)}
💵 *Total a Pagar:* *${totalStr}*
💳 *Método de Pago:* ${order.paymentMethod.toUpperCase()}
📍 *Dirección:* ${order.customerAddress}

${order.notes ? `📝 *Nota:* ${order.notes}\n` : ""}Te avisaremos en cuanto tu pedido salga en camino. ¡Muchas gracias!`;

    case "IN_ROUTE": {
      const carrierInfo = driver
        ? `🛵 *Repartidor:* ${driver.name}\n📞 *Teléfono:* ${driver.phone}\n🚗 *Vehículo:* ${driver.vehicleType} ${driver.licensePlate ? `(${driver.licensePlate})` : ""}`
        : agency
        ? `🏢 *Agencia:* ${agency.name}\n🔖 *Código de Envío:* ${order.trackingCode || "N/A"}\n📞 *Centralita:* ${agency.phone}`
        : "🛵 *Repartidor Asignado*";

      const timeEst = order.estimatedMinutes ? `⏱️ *Tiempo estimado:* ~${order.estimatedMinutes} min\n` : "";

      return `🚀 *¡Tu pedido #${order.orderNumber} va en camino!*

${carrierInfo}
${timeEst}📍 *Dirección de Entrega:* ${order.customerAddress}
💵 *Monto a Pagar:* *${totalStr}*

¡Por favor mantente atento para recibirlo! 👍`;
    }

    case "DELIVERED":
      return `✅ *¡Pedido #${order.orderNumber} Entregado con Éxito!*

Muchas gracias por tu compra en *${businessName}*. Esperamos que disfrutes tus productos.
¡Que tengas un excelente día! ⭐⭐⭐⭐⭐`;

    case "BILL_SUMMARY":
      return `🧾 *Comprobante de Pedido #${order.orderNumber}* - *${businessName}*
--------------------------------
👤 *Cliente:* ${order.customerName}
📞 *Teléfono:* ${order.customerPhone}
📍 *Dirección:* ${order.customerAddress}
--------------------------------
${itemsList}
--------------------------------
Subtotal: ${formatCurrency(order.itemsSubtotal, "CUP", rates)}
Envío: ${formatCurrency(order.deliveryFee, "CUP", rates)}
${order.tip ? `Propina: ${formatCurrency(order.tip, "CUP", rates)}\n` : ""}*TOTAL:* *${totalStr}*
Estado: ${order.paymentStatus === "COMPLETADO" ? "PAGADO ✅" : "PENDIENTE DE COBRO ⏳"} (${order.paymentMethod.toUpperCase()})
--------------------------------`;

    default:
      return `Hola ${order.customerName}, te escribimos de ${businessName} sobre tu pedido #${order.orderNumber}.`;
  }
}

export interface ParsedWhatsAppOrder {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLocationUrl?: string;
  items: DeliveryOrderItem[];
  deliveryFee: number;
  tip: number;
  notes: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  estimatedMinutes: number;
  totalParsed?: number;
}

/**
 * Strips zero-width chars, chat timestamps, forwarded headers and markdown styling
 */
function cleanRawLine(line: string): string {
  let cleaned = line
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F]/g, " ")
    .replace(/\r/g, "")
    .trim();

  // Strip WhatsApp message timestamp prefixes:
  // e.g. "[10:45 AM, 25/9/2026] +53 52123456: " or "[25/9/2026, 10:45] Carlos: " or "25/9/26, 10:45 - Sender: "
  cleaned = cleaned.replace(/^\[?\d{1,2}[:/.-]\d{1,2}(?:[:/.-]\d{2,4})?(?:,\s*|\s+)\d{1,2}[:/.-]\d{1,2}(?::\d{2})?(?:\s*[APap][Mm])?\]?\s*[-:]?\s*(?:[^:\n]+:)?\s*/i, "");

  // Strip standalone brackets timestamp: "[10:45 AM, 25/9/2026] +53 52123456"
  if (/^\[?\d{1,2}[:/.-]\d{1,2}.*\]?\s*[:\-]?\s*$/i.test(cleaned)) {
    return "";
  }

  // Strip "Mensaje reenviado" / "Forwarded"
  if (/^(?:mensaje\s+reenviado|forwarded\s+message|reenviado)\s*$/i.test(cleaned)) {
    return "";
  }

  return cleaned.trim();
}

/**
 * Normalizes text for matching (lowercased, accents stripped, alphanumeric only)
 */
function normalizeMatchText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strips emojis, bullets, and markdown from label candidate
 */
function cleanLabelKey(keyStr: string): string {
  return normalizeMatchText(
    keyStr
      .replace(/[*_~`]/g, "")
      .replace(/^[\s•*\-#>▪▫►✔✓👉📞📱☎️📲📍🗺️👤🛵💳📝]+/gu, "")
      .trim()
  );
}

/**
 * Extracts a phone number from any string, supporting international (+1, +34, +52, +53, etc.) and local formats
 */
export function extractPhoneFromText(text: string): string | null {
  if (!text) return null;

  // 1. Direct regex for labeled or standalone phone numbers
  // Matches +1 (786) 555-1234, +34 612 34 56 78, +53 52123456, +52 55 1234 5678, (305) 555-0123, 52123456, 5354987612, etc.
  const explicitPhoneMatch = text.match(
    /(?:(?:tel[eé]fono|celular|m[oó]vil|mobile|phone|whatsapp|wsp|ws|contacto|fono|num|n[uú]mero|📞|📱|☎️|📲)\s*[:=\-]?\s*)?(\+?\d{1,4}[-.\s()]*\d{1,4}[-.\s()]*\d{2,5}[-.\s()]*\d{2,5}|\+?\d{7,15})/i
  );

  if (explicitPhoneMatch && explicitPhoneMatch[1]) {
    const rawMatch = explicitPhoneMatch[1].trim();
    const digitsOnly = rawMatch.replace(/\D/g, "");
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return rawMatch;
    }
  }

  // 2. Global pattern scan for international with + or 00 prefix
  const intlMatch = text.match(/(?:\+|00)\d{1,4}[-.\s()]*(?:\d[-.\s()]*){6,13}\d/);
  if (intlMatch) {
    return intlMatch[0].trim();
  }

  // 3. Scan for any 7 to 12 digit number block (excluding dates or currency)
  const numbers = text.match(/\b\d{1,4}[-.\s]\d{3,4}[-.\s]\d{3,4}\b|\b\d{7,12}\b/g);
  if (numbers) {
    for (const num of numbers) {
      const d = num.replace(/\D/g, "");
      // Skip if it looks like a year or small price (e.g. 2026, 850, 1200)
      if (d.length >= 7 && d.length <= 13) {
        return num.trim();
      }
    }
  }

  return null;
}

/**
 * Extracts GPS URLs or raw coordinates (lat, lng) and converts them into standard Google Maps URLs
 */
export function extractGpsUrlOrCoordinates(text: string): string | null {
  if (!text) return null;

  // 1. Comprehensive Maps URL regex: Google Maps, Apple Maps, Waze, OpenStreetMap, geo:
  const mapsUrlRegex = /(https?:\/\/(?:[a-zA-Z0-9.-]+\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl|maps\.apple\.com|apple\.com\/maps|waze\.com|openstreetmap\.org|here\.com)\S+)/i;
  const mapsUrlMatch = text.match(mapsUrlRegex);
  if (mapsUrlMatch) {
    return mapsUrlMatch[1].replace(/[),;.]$/, "");
  }

  // 2. geo: URI scheme: geo:25.7617,-80.1918
  const geoMatch = text.match(/geo:(-?\d{1,3}\.\d{3,8}),\s*(-?\d{1,3}\.\d{3,8})/i);
  if (geoMatch) {
    return `https://www.google.com/maps?q=${geoMatch[1]},${geoMatch[2]}`;
  }

  // 3. Labeled coordinates: e.g. "GPS: 25.761680, -80.191790" or "Lat: 23.1354 Lng: -82.3598"
  const labeledCoordsMatch = text.match(
    /(?:gps|coordenadas|coords|lat(?:itud)?|ubicaci[oó]n|loc)\s*[:=\-]?\s*(-?\d{1,3}\.\d{3,8})[\s,]+(?:long?|lng|longitud)?\s*(-?\d{1,3}\.\d{3,8})/i
  );
  if (labeledCoordsMatch) {
    return `https://www.google.com/maps?q=${labeledCoordsMatch[1]},${labeledCoordsMatch[2]}`;
  }

  // 4. Raw coordinate pair on a standalone line: e.g. "25.761680, -80.191790"
  const rawCoordsMatch = text.match(/(-?\d{1,2}\.\d{4,8})\s*,\s*(-?\d{1,3}\.\d{4,8})/);
  if (rawCoordsMatch) {
    const lat = parseFloat(rawCoordsMatch[1]);
    const lng = parseFloat(rawCoordsMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }
  }

  return null;
}

/**
 * Generates a valid universal Google Maps search URL from any textual address
 */
export function generateGoogleMapsSearchUrl(address: string): string {
  if (!address || !address.trim()) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

/**
 * Assigns an appropriate fallback food/product emoji based on item name
 */
function inferEmojiFromName(name: string): string {
  const n = normalizeMatchText(name);
  if (n.includes("pizza")) return "🍕";
  if (n.includes("hamburguesa") || n.includes("burger")) return "🍔";
  if (n.includes("cerveza") || n.includes("cristal") || n.includes("bucanero") || n.includes("beer")) return "🍺";
  if (n.includes("refresco") || n.includes("cola") || n.includes("tukola") || n.includes("gaseosa") || n.includes("soda") || n.includes("7up") || n.includes("sprite")) return "🥤";
  if (n.includes("jugo") || n.includes("batido") || n.includes("smoothie") || n.includes("malteada")) return "🧃";
  if (n.includes("sandwich") || n.includes("sandwhich") || n.includes("pan con") || n.includes("bocadito")) return "🥪";
  if (n.includes("perro") || n.includes("hot dog") || n.includes("hotdog")) return "🌭";
  if (n.includes("taco") || n.includes("burrito") || n.includes("quesadilla")) return "🌮";
  if (n.includes("pollo") || n.includes("alita") || n.includes("pechuga")) return "🍗";
  if (n.includes("carne") || n.includes("bistec") || n.includes("lomo") || n.includes("costilla") || n.includes("asado")) return "🥩";
  if (n.includes("papas") || n.includes("fritas") || n.includes("chips")) return "🍟";
  if (n.includes("ensalada") || n.includes("vegetal") || n.includes("lechuga")) return "🥗";
  if (n.includes("pasta") || n.includes("espagueti") || n.includes("lasana") || n.includes("spaghetti")) return "🍝";
  if (n.includes("postre") || n.includes("dulce") || n.includes("cake") || n.includes("torta") || n.includes("helado") || n.includes("flan")) return "🍰";
  if (n.includes("cafe") || n.includes("capuchino") || n.includes("expreso")) return "☕";
  if (n.includes("agua") || n.includes("botella")) return "💧";
  if (n.includes("malta")) return "🧋";
  if (n.includes("arroz") || n.includes("congri") || n.includes("moros")) return "🍚";
  if (n.includes("combo")) return "🍱";
  return "📦";
}

/**
 * Parses numeric price string handling comma as thousands or decimals: e.g. "1,200", "850.00", "$950", "450 cup"
 */
function parsePriceNumber(raw: string): number {
  if (!raw) return 0;
  let clean = raw.replace(/[^\d.,]/g, "").trim();
  if (!clean) return 0;

  // If format is like "1,500" or "1.500" (thousands separator without decimals)
  if (/^\d{1,3}[,.]\d{3}$/.test(clean)) {
    clean = clean.replace(/[,.]/g, "");
    return parseFloat(clean) || 0;
  }
  // If format is like "1,500.00"
  if (/^\d{1,3},\d{3}\.\d+$/.test(clean)) {
    clean = clean.replace(/,/g, "");
    return parseFloat(clean) || 0;
  }
  // If format is like "1.500,00"
  if (/^\d{1,3}\.\d{3},\d+$/.test(clean)) {
    clean = clean.replace(/\./g, "").replace(/,/g, ".");
    return parseFloat(clean) || 0;
  }
  // Standard decimal with comma or dot: "850,50" -> "850.50"
  clean = clean.replace(/,/g, ".");
  return parseFloat(clean) || 0;
}

/**
 * Checks if a string is a casual greeting or system conversational text
 */
function isGreetingOrNoise(normLine: string): boolean {
  return (
    normLine === "hola" ||
    normLine === "buenas" ||
    normLine === "buenos dias" ||
    normLine === "buenas tardes" ||
    normLine === "buenas noches" ||
    normLine === "saludos" ||
    normLine === "hola buenas" ||
    normLine === "hola buenas tardes" ||
    normLine === "hola buenos dias" ||
    normLine === "hola buenas noches" ||
    normLine === "quiero hacer un pedido" ||
    normLine === "quiero pedir a domicilio" ||
    normLine === "quiero pedir para la casa" ||
    normLine === "pedido a domicilio" ||
    normLine === "nuevo pedido" ||
    normLine === "comanda de delivery" ||
    normLine === "muchas gracias" ||
    normLine === "gracias" ||
    normLine === "ok" ||
    normLine === "listo" ||
    normLine === "productos" ||
    normLine === "pedido" ||
    normLine === "comanda" ||
    normLine === "orden" ||
    normLine === "detalle" ||
    normLine === "menu"
  );
}

/**
 * Checks if a line is an unlabelled phone number
 */
function isStandalonePhone(line: string): string | null {
  return extractPhoneFromText(line);
}

/**
 * Checks if a line looks like an unlabelled address
 */
function isStandaloneAddress(line: string): boolean {
  const norm = normalizeMatchText(line);
  return (
    norm.includes("calle ") ||
    norm.includes("ave ") ||
    norm.includes("avenida ") ||
    norm.includes("calzada ") ||
    norm.includes("entre ") ||
    norm.includes(" e ") ||
    norm.includes("apto ") ||
    norm.includes("edificio ") ||
    norm.includes("reparto ") ||
    norm.includes("miramar") ||
    norm.includes("vedado") ||
    norm.includes("playa") ||
    norm.includes("plaza") ||
    norm.includes("habana") ||
    norm.includes("piso ") ||
    norm.includes("carrera ") ||
    norm.includes("diagonal ") ||
    norm.includes("boulevard ") ||
    norm.includes("paseo ") ||
    norm.includes("barrio ") ||
    norm.includes("colonia ") ||
    norm.includes("cp ") ||
    norm.includes("zip ") ||
    /#\s*\d+/.test(line) ||
    /no\.\s*\d+/i.test(line)
  );
}

/**
 * Intelligent parser for unstructured WhatsApp messages containing delivery orders.
 * Works seamlessly on mobile devices, extracting customer info, addresses, multiline notes,
 * catalog items, delivery fees, payment methods, and GPS location URLs.
 */
export function parseWhatsAppOrderText(
  rawText: string,
  catalog: Product[] = []
): ParsedWhatsAppOrder {
  if (!rawText || !rawText.trim()) {
    return {
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      customerLocationUrl: undefined,
      items: [],
      deliveryFee: 300,
      tip: 0,
      notes: "",
      paymentMethod: "cash",
      paymentStatus: "PENDIENTE",
      estimatedMinutes: 30,
    };
  }

  const rawLines = rawText.split("\n").map(cleanRawLine).filter(Boolean);

  let customerName = "";
  let customerPhone = "";
  let customerAddress = "";
  let customerLocationUrl: string | undefined = undefined;
  let notes = "";
  let deliveryFee = 0;
  let hasExplicitDeliveryFee = false;
  let tip = 0;
  let estimatedMinutes = 30;
  let paymentMethod: PaymentMethod = "cash";
  let paymentStatus: PaymentStatus = "PENDIENTE";
  const items: DeliveryOrderItem[] = [];

  // 1. Extract Google / Apple Maps / GPS location URLs or Raw Coordinates anywhere in the raw text
  const extractedGps = extractGpsUrlOrCoordinates(rawText);
  if (extractedGps) {
    customerLocationUrl = extractedGps;
  }

  let isReadingAddressContinuation = false;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const line = rawLine.replace(/^[*_~`]+|[*_~`]+$/g, "").trim();
    if (!line) continue;

    // Check if line is a timestamp header: "[10:45 AM, 25/9/2026] +53 52123456"
    if (/^\[?\d{1,2}[:/.-]\d{1,2}/.test(line) && line.length < 40) {
      // If contains phone, extract it
      const ph = isStandalonePhone(line);
      if (ph && !customerPhone) customerPhone = ph;
      continue;
    }

    // Check if line contains a label-value separator like ':', '=', or '-'
    let detectedKey = "";
    let detectedVal = "";

    const colonIdx = line.indexOf(":");
    const equalIdx = line.indexOf("=");
    const splitIdx = colonIdx !== -1 ? colonIdx : equalIdx;

    if (splitIdx > 0 && splitIdx < line.length - 1) {
      detectedKey = cleanLabelKey(line.substring(0, splitIdx));
      detectedVal = line.substring(splitIdx + 1).replace(/^[*_~`]+|[*_~`]+$/g, "").trim();
    }

    // Evaluate recognized labeled keys
    if (detectedKey) {
      // 1. Customer Name
      if (
        detectedKey === "cliente" ||
        detectedKey === "nombre" ||
        detectedKey === "nombres" ||
        detectedKey === "nombre y apellidos" ||
        detectedKey === "destinatario" ||
        detectedKey === "para" ||
        detectedKey === "comprador" ||
        detectedKey === "titular" ||
        detectedKey === "recibe" ||
        detectedKey === "a nombre de" ||
        detectedKey === "customer" ||
        detectedKey === "client" ||
        detectedKey === "name"
      ) {
        if (detectedVal) customerName = detectedVal;
        isReadingAddressContinuation = false;
        continue;
      }

      // 2. Customer Phone
      if (
        detectedKey === "telefono" ||
        detectedKey === "tel" ||
        detectedKey === "tlf" ||
        detectedKey === "telf" ||
        detectedKey === "telef" ||
        detectedKey === "celular" ||
        detectedKey === "cel" ||
        detectedKey === "movil" ||
        detectedKey === "mobile" ||
        detectedKey === "phone" ||
        detectedKey === "whatsapp" ||
        detectedKey === "wsp" ||
        detectedKey === "ws" ||
        detectedKey === "wa" ||
        detectedKey === "contacto" ||
        detectedKey === "contact" ||
        detectedKey === "fono" ||
        detectedKey === "numero" ||
        detectedKey === "num" ||
        detectedKey === "numero de telefono" ||
        detectedKey === "numero de celular" ||
        detectedKey === "numero de contacto" ||
        detectedKey.includes("telefono") ||
        detectedKey.includes("celular") ||
        detectedKey.includes("whatsapp") ||
        detectedKey.includes("phone")
      ) {
        const ph = extractPhoneFromText(detectedVal) || detectedVal;
        if (ph) customerPhone = ph;
        isReadingAddressContinuation = false;
        continue;
      }

      // 3. GPS / Maps Link / Coordinates
      if (
        detectedKey === "gps" ||
        detectedKey === "coordenadas" ||
        detectedKey === "coords" ||
        detectedKey === "mapa" ||
        detectedKey === "maps" ||
        detectedKey === "link gps" ||
        detectedKey === "enlace gps" ||
        detectedKey === "link de ubicacion" ||
        detectedKey === "ubicacion gps"
      ) {
        const gpsVal = extractGpsUrlOrCoordinates(detectedVal) || (detectedVal.startsWith("http") ? detectedVal : undefined);
        if (gpsVal) customerLocationUrl = gpsVal;
        isReadingAddressContinuation = false;
        continue;
      }

      // 4. Address
      if (
        detectedKey === "direccion" ||
        detectedKey === "dir" ||
        detectedKey === "ubicacion" ||
        detectedKey === "entrega" ||
        detectedKey === "destino" ||
        detectedKey === "domicilio" ||
        detectedKey === "llegar a" ||
        detectedKey === "llevar a" ||
        detectedKey === "entregar en" ||
        detectedKey === "lugar" ||
        detectedKey === "casa" ||
        detectedKey === "address" ||
        detectedKey === "delivery address"
      ) {
        // If the value contains a map URL, also extract it
        const mapInAddress = extractGpsUrlOrCoordinates(detectedVal);
        if (mapInAddress && !customerLocationUrl) {
          customerLocationUrl = mapInAddress;
        }

        if (detectedVal) customerAddress = detectedVal;
        isReadingAddressContinuation = true;
        continue;
      }

      // 5. Delivery Fee
      if (
        detectedKey === "envio" ||
        detectedKey === "delivery" ||
        detectedKey === "costo de envio" ||
        detectedKey === "costo envio" ||
        detectedKey === "costo domicilio" ||
        detectedKey === "tarifa" ||
        detectedKey === "tarifa de envio" ||
        detectedKey === "transporte" ||
        detectedKey === "flete" ||
        detectedKey === "mensajeria"
      ) {
        deliveryFee = parsePriceNumber(detectedVal);
        hasExplicitDeliveryFee = true;
        isReadingAddressContinuation = false;
        continue;
      }

      // 6. Tip
      if (detectedKey === "propina" || detectedKey === "tip") {
        tip = parsePriceNumber(detectedVal);
        isReadingAddressContinuation = false;
        continue;
      }

      // 7. Estimated Time
      if (
        detectedKey === "tiempo" ||
        detectedKey === "demora" ||
        detectedKey === "estimado" ||
        detectedKey === "tarda" ||
        detectedKey === "entrega estimada" ||
        detectedKey === "hora" ||
        detectedKey === "hora de entrega"
      ) {
        const timeMatch = detectedVal.match(/(\d+)/);
        if (timeMatch) estimatedMinutes = parseInt(timeMatch[1], 10);
        isReadingAddressContinuation = false;
        continue;
      }

      // 8. Payment Method & Payment Status
      if (
        detectedKey === "pago" ||
        detectedKey === "metodo de pago" ||
        detectedKey === "forma de pago" ||
        detectedKey === "medio de pago" ||
        detectedKey === "pagar con" ||
        detectedKey === "abono"
      ) {
        const payStr = detectedVal.toLowerCase();
        if (payStr.includes("transfermovil") || payStr.includes("transfermóvil") || payStr.includes("tm")) {
          paymentMethod = "transfermovil";
        } else if (payStr.includes("enzona") || payStr.includes("ez")) {
          paymentMethod = "enzona";
        } else if (payStr.includes("transfer") || payStr.includes("banco") || payStr.includes("tarjeta") || payStr.includes("bpa") || payStr.includes("bandec") || payStr.includes("metropolitano")) {
          paymentMethod = "transfer";
        } else if (payStr.includes("mixto")) {
          paymentMethod = "mixed";
        } else {
          paymentMethod = "cash";
        }

        if (
          payStr.includes("pagado") ||
          payStr.includes("transferido") ||
          payStr.includes("ya pag") ||
          payStr.includes("adelantado") ||
          payStr.includes("comprobante") ||
          payStr.includes("listo")
        ) {
          paymentStatus = "COMPLETADO";
        } else if (
          payStr.includes("pendiente") ||
          payStr.includes("contra entrega") ||
          payStr.includes("al entregar") ||
          payStr.includes("al recibir") ||
          payStr.includes("por cobrar")
        ) {
          paymentStatus = "PENDIENTE";
        }
        isReadingAddressContinuation = false;
        continue;
      }

      // 9. Notes
      if (
        detectedKey === "nota" ||
        detectedKey === "notas" ||
        detectedKey === "comentario" ||
        detectedKey === "comentarios" ||
        detectedKey === "observacion" ||
        detectedKey === "observaciones" ||
        detectedKey === "indicacion" ||
        detectedKey === "indicaciones" ||
        detectedKey === "timbre" ||
        detectedKey === "referencia" ||
        detectedKey === "referencias" ||
        detectedKey === "aclaracion" ||
        detectedKey === "al llegar"
      ) {
        notes = detectedVal;
        isReadingAddressContinuation = false;
        continue;
      }

      // Section headers (e.g. "Productos:", "Pedido:", "Comanda:")
      if (
        detectedKey === "pedido" ||
        detectedKey === "productos" ||
        detectedKey === "comanda" ||
        detectedKey === "orden" ||
        detectedKey === "detalle" ||
        detectedKey === "menu" ||
        detectedKey === "consumo" ||
        detectedKey === "lo que pide" ||
        detectedKey === "articulos" ||
        detectedKey === "items"
      ) {
        isReadingAddressContinuation = false;
        if (detectedVal && detectedVal.length > 2) {
          const it = parseItemLine(detectedVal, catalog);
          if (it) items.push(it);
        }
        continue;
      }
    }

    // Check if line starts with phone emojis (📞, 📱, ☎️, 📲) without colon: e.g. "📞 +1 (786) 555-1234"
    if (/^(?:📞|📱|☎️|📲)/.test(line)) {
      const ph = extractPhoneFromText(line);
      if (ph) {
        customerPhone = ph;
        isReadingAddressContinuation = false;
        continue;
      }
    }

    // If previous line was address, check if this line is an address continuation (e.g. "e/ 23 y 25 Apto 4B, Vedado" or "Piso 3, Puerta A, Madrid")
    if (isReadingAddressContinuation) {
      const isContinuation =
        /^(?:e\/|entre\s|apto|apartamento|edificio|piso|puerta|reparto|rpto|municipio|#|no\.|calle|ave|avenida|casa|interior|bajos|altos|frente|al\s+lado|bloque|cp|zip)/i.test(line);
      if (isContinuation) {
        customerAddress += `, ${line.replace(/[*_~`]/g, "").trim()}`;
        continue;
      } else {
        isReadingAddressContinuation = false;
      }
    }

    // Skip greeting or noise lines
    const normLine = normalizeMatchText(line);
    if (isGreetingOrNoise(normLine)) {
      continue;
    }

    // Skip standalone maps links if already captured
    if (extractGpsUrlOrCoordinates(line)) {
      continue;
    }

    // Skip lines that are just totals like "Total: $3500" or "Subtotal: $2000"
    if (normLine.startsWith("total") || normLine.startsWith("subtotal") || normLine.startsWith("importe total")) {
      continue;
    }

    // Check if unlabelled line is a phone number
    const standalonePhone = isStandalonePhone(line);
    if (standalonePhone && !customerPhone) {
      customerPhone = standalonePhone;
      continue;
    }

    // Check if unlabelled line is an address
    if (isStandaloneAddress(line) && !customerAddress) {
      customerAddress = line;
      isReadingAddressContinuation = true;
      continue;
    }

    // Check if unlabelled line is a payment method
    if (normLine === "transferencia" || normLine === "transfermovil" || normLine === "enzona" || normLine === "efectivo" || normLine === "pago por enzona" || normLine === "pago por transfermovil") {
      if (normLine.includes("transfermovil")) paymentMethod = "transfermovil";
      else if (normLine.includes("enzona")) paymentMethod = "enzona";
      else if (normLine.includes("transfer")) paymentMethod = "transfer";
      else paymentMethod = "cash";
      continue;
    }

    // Check if line is "Envio 200" or "Delivery 300"
    const unlabelledFeeMatch = normLine.match(/^(?:envio|delivery|tarifa|flete|transporte)\s+[\$]?\s*(\d+(?:[.,]\d+)?)/);
    if (unlabelledFeeMatch) {
      deliveryFee = parsePriceNumber(unlabelledFeeMatch[1]);
      hasExplicitDeliveryFee = true;
      continue;
    }

    // Attempt to parse line as an Item / Product
    const item = parseItemLine(rawLine, catalog);
    if (item) {
      items.push(item);
      continue;
    }

    // If no customer name yet, and this is the first non-greeting line with 2-4 words and no numbers
    if (!customerName && i === 0 && /^([a-zA-ZÁÉÍÓÚÑáéíóúñ]+\s+){1,3}[a-zA-ZÁÉÍÓÚÑáéíóúñ]+$/.test(line)) {
      customerName = line;
      continue;
    }
  }

  // Fallbacks if not explicitly tagged:

  // 1. Phone fallback: scan entire raw text for phone numbers
  if (!customerPhone) {
    const fallbackPhone = extractPhoneFromText(rawText);
    if (fallbackPhone) {
      customerPhone = fallbackPhone;
    }
  }

  // 2. Name fallback: look for greetings with a name like "Hola soy Alejandro" or "A nombre de Alejandro"
  if (!customerName) {
    const greetingNameMatch = rawText.match(/(?:hola\s+(?:soy|es)|a\s+nombre\s+de|para)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,30})/i);
    if (greetingNameMatch) {
      customerName = greetingNameMatch[1].trim();
    }
  }

  // 3. GPS Location URL fallback: if address was extracted and no GPS link was in text, auto-generate universal Google Maps search URL from address!
  if (!customerLocationUrl && customerAddress.trim()) {
    customerLocationUrl = generateGoogleMapsSearchUrl(customerAddress);
  }

  // 4. Payment Method detection anywhere in the text if still default
  const lowerAll = rawText.toLowerCase();
  if (paymentMethod === "cash") {
    if (lowerAll.includes("transfermovil") || lowerAll.includes("transfermóvil") || lowerAll.includes("tm")) {
      paymentMethod = "transfermovil";
    } else if (lowerAll.includes("enzona") || lowerAll.includes("en zona") || lowerAll.includes("ez")) {
      paymentMethod = "enzona";
    } else if (lowerAll.includes("transferencia") || lowerAll.includes("bpa") || lowerAll.includes("bandec") || lowerAll.includes("metropolitano")) {
      paymentMethod = "transfer";
    }
  }

  if (paymentStatus === "PENDIENTE") {
    if (
      lowerAll.includes("transferido") ||
      lowerAll.includes("ya fue transferido") ||
      lowerAll.includes("ya transferí") ||
      lowerAll.includes("comprobante adjunto") ||
      lowerAll.includes("pago confirmado")
    ) {
      paymentStatus = "COMPLETADO";
    }
  }

  // Default fee fallback if not detected
  if (!hasExplicitDeliveryFee && deliveryFee === 0) {
    deliveryFee = 300;
  }

  return {
    customerName,
    customerPhone,
    customerAddress,
    customerLocationUrl,
    items,
    deliveryFee,
    tip,
    notes,
    paymentMethod,
    paymentStatus,
    estimatedMinutes,
  };
}

/**
 * Parses an individual text line into a DeliveryOrderItem
 */
function parseItemLine(line: string, catalog: Product[] = []): DeliveryOrderItem | null {
  let text = cleanRawLine(line);
  if (!text || text.length < 2) return null;

  // Remove leading bullets, list markers, emojis or checkboxes: e.g. "• ", "- ", "* ", "1. ", "✔ ", "[ ] "
  text = text.replace(/^(?:[-*•+▪▫►✔✓👉]|\[[ xX]?\]|\d+\s*[.)-])\s*/, "").trim();
  if (!text) return null;

  // Ignore lines that look like status headers or metadata
  const norm = normalizeMatchText(text);
  if (
    isGreetingOrNoise(norm) ||
    norm.startsWith("nota") ||
    norm.startsWith("cliente") ||
    norm.startsWith("telefono") ||
    norm.startsWith("direccion") ||
    norm.startsWith("envio") ||
    norm.startsWith("total") ||
    norm.startsWith("subtotal") ||
    norm.startsWith("pago") ||
    norm.startsWith("tiempo")
  ) {
    return null;
  }

  let qty = 1;
  let hasExplicitQty = false;
  let remainingText = text;

  // 1. Check quantity prefix: e.g. "2x Hamburguesa", "2 x Pizza", "3 - Cervezas", "2 de Hamburguesa", "2 Pizza"
  const qtyPrefixMatch = remainingText.match(/^(\d+(?:\.\d+)?)\s*(?:[xX*]|de\s+|-|\s+)?\s*(.+)$/);
  if (qtyPrefixMatch) {
    const parsedQty = parseFloat(qtyPrefixMatch[1]);
    if (parsedQty > 0 && parsedQty <= 500) {
      qty = parsedQty;
      hasExplicitQty = true;
      remainingText = qtyPrefixMatch[2].trim();
    }
  } else {
    // Check quantity suffix: e.g. "Hamburguesa Especial x2" or "Pizza Jamon (3u)"
    const qtySuffixMatch = remainingText.match(/^(.+?)\s*(?:[xX*]|cant:?|\()\s*(\d+)(?:\s*(?:u|unidades|uds|\)))?$/i);
    if (qtySuffixMatch) {
      qty = parseInt(qtySuffixMatch[2], 10) || 1;
      hasExplicitQty = true;
      remainingText = qtySuffixMatch[1].trim();
    }
  }

  // 2. Extract price from remaining text
  let explicitPrice: number | undefined = undefined;

  // Handle equation at end of line: "2x Hamburguesa ($850) = $1700" or "2x Hamburguesa 850 -> 1700"
  const equationMatch = remainingText.match(/(.+?)(?:\s*(?:=|->|=>|total:?)\s*[\$]?\s*[\d,]+(?:\.\d+)?\s*(?:cup|mn|\$)?)$/i);
  if (equationMatch) {
    remainingText = equationMatch[1].trim();
  }

  // Check parenthesized price: e.g. "Hamburguesa Especial ($850)" or "Pizza Jamon (850 cup)" or "(850 c/u)"
  const parenPriceMatch = remainingText.match(/^(.+?)\s*\(\s*[\$]?\s*([\d,]+(?:\.\d+)?)\s*(?:cup|mn|\$|pesos|c\/u|cada\s*un[oa])?\s*\)$/i);
  if (parenPriceMatch) {
    remainingText = parenPriceMatch[1].trim();
    explicitPrice = parsePriceNumber(parenPriceMatch[2]);
  } else {
    // Check price suffix: e.g. "Hamburguesa Especial - $850", "Pizza a 850", "Refresco $250 CUP", "Cerveza 400"
    const suffixPriceMatch = remainingText.match(/^(.+?)\s*(?:[-–—:]|a|en)?\s*[\$]?\s*([\d,]+(?:\.\d+)?)\s*(?:cup|mn|\$|pesos|c\/u|cada\s*un[oa])\s*$/i);
    if (suffixPriceMatch) {
      remainingText = suffixPriceMatch[1].trim();
      explicitPrice = parsePriceNumber(suffixPriceMatch[2]);
    } else {
      // Check plain trailing number if product name has text: e.g. "Hamburguesa Especial 850"
      const plainTrailingNumMatch = remainingText.match(/^([a-zA-ZÁÉÍÓÚÑáéíóúñ\s\d.,/#+-]+[a-zA-ZÁÉÍÓÚÑáéíóúñ])\s+[\$]?\s*(\d{2,6}(?:[.,]\d{2})?)\s*$/);
      if (plainTrailingNumMatch) {
        const candidateNum = parsePriceNumber(plainTrailingNumMatch[2]);
        const candidateName = plainTrailingNumMatch[1].trim();
        if (candidateNum >= 20) {
          remainingText = candidateName;
          explicitPrice = candidateNum;
        }
      }
    }
  }

  // Clean remaining product name
  let itemName = remainingText
    .replace(/^[*_~`]+|[*_~`]+$/g, "")
    .replace(/\s*[-–—:]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!itemName || itemName.length < 2) return null;

  // 3. Match against catalog products
  const normalizedCandidate = normalizeMatchText(itemName);

  let matchedProduct: Product | undefined = undefined;

  // Exact match
  matchedProduct = catalog.find(
    (p) => normalizeMatchText(p.name) === normalizedCandidate
  );

  // Plural/singular normalization match: e.g. "hamburguesas" -> "hamburguesa", "pizzas" -> "pizza"
  if (!matchedProduct) {
    const singular = normalizedCandidate
      .replace(/es\b/, "")
      .replace(/s\b/, "");
    matchedProduct = catalog.find((p) => {
      const pNorm = normalizeMatchText(p.name);
      const pSingular = pNorm.replace(/es\b/, "").replace(/s\b/, "");
      return pSingular === singular || pNorm.startsWith(singular) || singular.startsWith(pNorm);
    });
  }

  // Substring match
  if (!matchedProduct && normalizedCandidate.length >= 4) {
    matchedProduct = catalog.find((p) => {
      const pNorm = normalizeMatchText(p.name);
      return pNorm.includes(normalizedCandidate) || normalizedCandidate.includes(pNorm);
    });
  }

  // CRITICAL VALIDATION: To prevent phantom items from random conversational text,
  // the line MUST have either:
  // 1. Explicit quantity (e.g. 2x)
  // 2. Explicit price (e.g. $850)
  // 3. Match a known product in the catalog
  if (!hasExplicitQty && explicitPrice === undefined && !matchedProduct) {
    return null;
  }

  const finalName = matchedProduct?.name || itemName;
  const finalPrice =
    explicitPrice !== undefined && explicitPrice > 0
      ? explicitPrice
      : matchedProduct?.price || 0;
  const finalEmoji = matchedProduct?.emoji || inferEmojiFromName(finalName);
  const finalUnit = matchedProduct?.unit || "u";

  return {
    productId: matchedProduct?.id,
    name: finalName,
    emoji: finalEmoji,
    qty,
    price: finalPrice,
    unit: finalUnit,
  };
}

import type { DeliveryOrder, DeliveryOrderItem, DeliveryStatus, DeliveryDriver, DeliveryAgency, Product, ExchangeRates } from "../types";
import { formatCurrency } from "./currency";

/**
 * Normalizes phone numbers for WhatsApp URL (defaults to +53 for Cuba if 8-digit phone starting with 5)
 */
export function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  
  // If it's 8 digits starting with 5 (standard Cuban mobile: 5xxxxxxx), prepend 53
  if (digits.length === 8 && digits.startsWith("5")) {
    return `53${digits}`;
  }
  // If it already has 53 and 8 digits (total 10)
  if (digits.length === 10 && digits.startsWith("535")) {
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
      return `👋 *¡Hola ${order.customerName}!*

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

/**
 * Intelligent parser for unstructured WhatsApp messages containing delivery orders
 */
export function parseWhatsAppOrderText(
  rawText: string,
  catalog: Product[] = []
): {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLocationUrl?: string;
  items: DeliveryOrderItem[];
  deliveryFee: number;
  notes: string;
  paymentMethod: "cash" | "transfermovil" | "enzona" | "transfer";
} {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  let customerName = "";
  let customerPhone = "";
  let customerAddress = "";
  let customerLocationUrl = "";
  let notes = "";
  let deliveryFee = 0;
  let paymentMethod: "cash" | "transfermovil" | "enzona" | "transfer" = "cash";
  const items: DeliveryOrderItem[] = [];

  // Regex patterns
  const namePattern = /^(?:cliente|nombre|para|comprador)\s*[:=-]\s*(.+)$/i;
  const phonePattern = /^(?:tel[eé]fono|tel|celular|m[oó]vil|whatsapp|contacto)\s*[:=-]\s*([\d\s+-]+)$/i;
  const addressPattern = /^(?:direcci[oó]n|dir|ubicaci[oó]n|entrega|destino)\s*[:=-]\s*(.+)$/i;
  const mapsPattern = /(https?:\/\/(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)\S+)/i;
  const feePattern = /^(?:env[ií]o|delivery|costo\s*de\s*env[ií]o|tarifa|transporte|flete)\s*[:=-]\s*[\$]?\s*(\d+(?:\.\d+)?)/i;
  const paymentPattern = /^(?:pago|m[eé]todo\s*de\s*pago|forma\s*de\s*pago)\s*[:=-]\s*(.+)$/i;
  const notesPattern = /^(?:nota|notas|comentario|observaci[oó]n|timbre)\s*[:=-]\s*(.+)$/i;

  // Item parser pattern: e.g. "2x Hamburguesa Clásica ($850)" or "- 1 Pizza Jamon 600" or "2 Cervezas Cristal"
  const itemPattern = /^(?:[-*•]\s*)?(\d+)\s*(?:x\s*|\s+de\s+|\s+)?([^($\d]+?)(?:\s*\(?[\$]?\s*(\d+(?:\.\d+)?)\)?)?$/i;

  for (const line of lines) {
    // Check maps URL anywhere
    const mapsMatch = line.match(mapsPattern);
    if (mapsMatch) {
      customerLocationUrl = mapsMatch[1];
    }

    // Check Name
    const nameMatch = line.match(namePattern);
    if (nameMatch) {
      customerName = nameMatch[1].trim();
      continue;
    }

    // Check Phone
    const phoneMatch = line.match(phonePattern);
    if (phoneMatch) {
      customerPhone = phoneMatch[1].trim();
      continue;
    }

    // Check Address
    const addressMatch = line.match(addressPattern);
    if (addressMatch) {
      customerAddress = addressMatch[1].trim();
      continue;
    }

    // Check Delivery Fee
    const feeMatch = line.match(feePattern);
    if (feeMatch) {
      deliveryFee = parseFloat(feeMatch[1]) || 0;
      continue;
    }

    // Check Payment Method
    const payMatch = line.match(paymentPattern);
    if (payMatch) {
      const payStr = payMatch[1].toLowerCase();
      if (payStr.includes("transfermovil") || payStr.includes("transfermóvil") || payStr.includes("tm")) {
        paymentMethod = "transfermovil";
      } else if (payStr.includes("enzona") || payStr.includes("ez")) {
        paymentMethod = "enzona";
      } else if (payStr.includes("transfer") || payStr.includes("banco")) {
        paymentMethod = "transfer";
      } else {
        paymentMethod = "cash";
      }
      continue;
    }

    // Check Notes
    const notesMatch = line.match(notesPattern);
    if (notesMatch) {
      notes = notesMatch[1].trim();
      continue;
    }

    // Check if line looks like an item
    const itemMatch = line.match(itemPattern);
    if (itemMatch) {
      const qty = parseInt(itemMatch[1], 10) || 1;
      const itemNameCandidate = itemMatch[2].trim();
      const explicitPrice = itemMatch[3] ? parseFloat(itemMatch[3]) : undefined;

      // Try to match against catalog
      let matchedProduct = catalog.find(
        (p) => p.name.toLowerCase() === itemNameCandidate.toLowerCase()
      );
      if (!matchedProduct) {
        // partial match
        matchedProduct = catalog.find((p) =>
          p.name.toLowerCase().includes(itemNameCandidate.toLowerCase()) ||
          itemNameCandidate.toLowerCase().includes(p.name.toLowerCase())
        );
      }

      const price = explicitPrice !== undefined ? explicitPrice : (matchedProduct?.price || 0);
      const name = matchedProduct?.name || itemNameCandidate;
      const emoji = matchedProduct?.emoji || "📦";
      const unit = matchedProduct?.unit || "u";

      if (name && name.length > 1) {
        items.push({
          productId: matchedProduct?.id,
          name,
          emoji,
          qty,
          price,
          unit,
        });
      }
    }
  }

  // Fallbacks if not explicitly tagged
  if (!customerPhone) {
    const rawPhones = rawText.match(/(?:\+?53\s*)?(?:5\d{7}|\b5\d{3}\s*\d{4}\b)/);
    if (rawPhones) {
      customerPhone = rawPhones[0].replace(/\s+/g, "");
    }
  }

  return {
    customerName,
    customerPhone,
    customerAddress,
    customerLocationUrl,
    items,
    deliveryFee,
    notes,
    paymentMethod,
  };
}

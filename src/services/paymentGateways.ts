import type { PaymentMethod, PaymentStatus, GatewayPayload } from "../types";

export interface PaymentGatewayConfig {
  transfermovil: {
    merchantPhone: string;
    merchantCard: string;
    enabled: boolean;
  };
  enzona: {
    merchantId: string;
    merchantName: string;
    apiKey: string;
    enabled: boolean;
  };
}

export const DEFAULT_GATEWAY_CONFIG: PaymentGatewayConfig = {
  transfermovil: {
    merchantPhone: "52000000",
    merchantCard: "9200000000000000",
    enabled: true,
  },
  enzona: {
    merchantId: "CAJAMASTER_CUB_001",
    merchantName: "CajaMaster POS",
    apiKey: "",
    enabled: true,
  },
};

const GATEWAY_STORAGE_KEY = "cajamaster_gateway_config_v1";

export function getGatewayConfig(): PaymentGatewayConfig {
  try {
    const raw = localStorage.getItem(GATEWAY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_GATEWAY_CONFIG,
        ...parsed,
        transfermovil: { ...DEFAULT_GATEWAY_CONFIG.transfermovil, ...(parsed.transfermovil || {}) },
        enzona: { ...DEFAULT_GATEWAY_CONFIG.enzona, ...(parsed.enzona || {}) },
      };
    }
  } catch (e) {
    console.error("Error reading gateway config:", e);
  }
  return DEFAULT_GATEWAY_CONFIG;
}

export function saveGatewayConfig(cfg: PaymentGatewayConfig): void {
  try {
    localStorage.setItem(GATEWAY_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.error("Error saving gateway config:", e);
  }
}

export interface PaymentRequest {
  saleId: string;
  ticketNumber: number;
  amountCUP: number;
  concept: string;
  clientPhone?: string;
}

export interface GatewayExecutionResult {
  provider: "transfermovil" | "enzona";
  saleId: string;
  transactionId: string;
  reference: string;
  deepLink: string;
  deepLinkUrl: string;
  androidIntentUrl?: string;
  ussdCode?: string;
  qrPayload?: string;
  initialStatus: PaymentStatus;
  instructions: string;
  payload: GatewayPayload;
}

/**
 * Transfermóvil Gateway Handler
 * Generates official Transfermóvil deep link schemas, Android intents, and USSD dial strings (*444*40*...).
 */
export const TransfermovilGateway = {
  id: "transfermovil" as const,
  name: "Transfermóvil",
  requiresOnline: true,

  generatePaymentPayload(
    amountCUP: number,
    phoneTarget?: string,
    conceptText?: string
  ): {
    provider: "transfermovil";
    reference: string;
    transactionId: string;
    deepLink: string;
    ussdCode: string;
    phone: string;
    amount: number;
    concept: string;
  } {
    const config = getGatewayConfig().transfermovil;
    const phone = phoneTarget || config.merchantPhone || "52000000";
    const ref = `TM_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const concept = conceptText || "Pago en POS";
    const deepLink = `transfermovil://pay?phone=${phone}&amount=${amountCUP.toFixed(2)}&concept=${encodeURIComponent(concept)}&ref=${ref}`;
    const ussdCode = `*444*40*${phone}*${Math.round(amountCUP)}#`;

    return {
      provider: "transfermovil",
      reference: ref,
      transactionId: ref,
      deepLink,
      ussdCode,
      phone,
      amount: amountCUP,
      concept,
    };
  },

  createPayment(req: PaymentRequest): GatewayExecutionResult {
    const config = getGatewayConfig().transfermovil;
    const phone = req.clientPhone || config.merchantPhone || "52000000";
    const amount = req.amountCUP.toFixed(2);
    const concept = encodeURIComponent(req.concept || `Ticket #${req.ticketNumber}`);
    const transactionId = `TM_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Standard deep link URI schema for Transfermóvil
    const deepLinkUrl = `transfermovil://pay?phone=${phone}&amount=${amount}&concept=${concept}&ref=${transactionId}&saleId=${req.saleId}`;
    
    // Android Intent format fallback
    const androidIntentUrl = `intent://pay?phone=${phone}&amount=${amount}&concept=${concept}&ref=${transactionId}#Intent;scheme=transfermovil;package=cu.etecsa.cubacel.tr.tm;end`;

    // USSD direct dial code: *444*40*PHONE*AMOUNT# (standard Transfermóvil payment string)
    const ussdCode = `*444*40*${phone}*${Math.round(req.amountCUP)}#`;

    const payload: GatewayPayload = {
      provider: "transfermovil",
      transactionId,
      deepLinkUrl,
      ussdCode,
      phone,
      accountNumber: config.merchantCard,
      concept: req.concept,
      initiatedAt: Date.now(),
    };

    return {
      provider: "transfermovil",
      saleId: req.saleId,
      transactionId,
      reference: transactionId,
      deepLink: deepLinkUrl,
      deepLinkUrl,
      androidIntentUrl,
      ussdCode,
      qrPayload: `TM:${phone}:${amount}:${transactionId}`,
      initialStatus: "PENDIENTE",
      instructions: `Realiza la transferencia de $${amount} CUP al número ${phone} o marca ${ussdCode} desde tu línea Cubacel.`,
      payload,
    };
  },
};

/**
 * EnZona Gateway Handler
 * Generates EnZona deep links, payment URLs, and standard QR payload schemas.
 */
export const EnzonaGateway = {
  id: "enzona" as const,
  name: "EnZona",
  requiresOnline: true,

  generatePaymentPayload(
    amountCUP: number,
    merchantTarget?: string,
    conceptText?: string
  ): {
    provider: "enzona";
    reference: string;
    transactionId: string;
    deepLink: string;
    amount: number;
    concept: string;
  } {
    const config = getGatewayConfig().enzona;
    const merchantId = merchantTarget || config.merchantId || "CAJAMASTER_CUB_001";
    const ref = `EZ_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const concept = conceptText || "Pago en POS";
    const deepLink = `enzona://payment?merchant_uuid=${merchantId}&amount=${amountCUP.toFixed(2)}&transaction_id=${ref}&description=${encodeURIComponent(concept)}`;

    return {
      provider: "enzona",
      reference: ref,
      transactionId: ref,
      deepLink,
      amount: amountCUP,
      concept,
    };
  },

  createPayment(req: PaymentRequest): GatewayExecutionResult {
    const config = getGatewayConfig().enzona;
    const merchantId = config.merchantId || "CAJAMASTER_CUB_001";
    const amount = req.amountCUP.toFixed(2);
    const transactionId = `EZ_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const concept = encodeURIComponent(req.concept || `Ticket #${req.ticketNumber}`);

    // Deep link schema for EnZona App
    const deepLinkUrl = `enzona://payment?merchant_uuid=${merchantId}&amount=${amount}&transaction_id=${transactionId}&sale_id=${req.saleId}&description=${concept}`;
    
    // Web payment gateway link fallback
    const webPaymentUrl = `https://enzona.net/payment/checkout?merchant=${merchantId}&amount=${amount}&ref=${transactionId}`;

    // Standard EnZona QR payload structure
    const qrPayload = JSON.stringify({
      app: "ENZONA",
      merchant: merchantId,
      merchant_name: config.merchantName,
      amount: parseFloat(amount),
      currency: "CUP",
      transaction_id: transactionId,
      sale_id: req.saleId,
      concept: req.concept || `Ticket #${req.ticketNumber}`,
      created_at: Date.now(),
    });

    const payload: GatewayPayload = {
      provider: "enzona",
      transactionId,
      deepLinkUrl,
      qrCodeData: qrPayload,
      accountNumber: merchantId,
      concept: req.concept,
      initiatedAt: Date.now(),
    };

    return {
      provider: "enzona",
      saleId: req.saleId,
      transactionId,
      reference: transactionId,
      deepLink: deepLinkUrl,
      deepLinkUrl,
      androidIntentUrl: webPaymentUrl,
      qrPayload,
      initialStatus: "PENDIENTE",
      instructions: `Escanea el código QR desde la aplicación EnZona o abre el enlace de pago directo para pagar $${amount} CUP.`,
      payload,
    };
  },
};

/**
 * Trigger Deep Link attempt in browser / mobile environment
 */
export function openGatewayDeepLink(url: string, fallbackUrl?: string): void {
  try {
    const start = Date.now();
    window.location.href = url;

    // If app is not installed, fallback after a short delay
    if (fallbackUrl) {
      setTimeout(() => {
        if (Date.now() - start < 2000) {
          window.open(fallbackUrl, "_blank", "noopener,noreferrer");
        }
      }, 1500);
    }
  } catch (err) {
    console.warn("Could not trigger deep link:", err);
    if (fallbackUrl) {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    }
  }
}

/**
 * Query Payment Gateway Status from Backend API
 */
export async function fetchPaymentStatusFromBackend(
  saleId: string
): Promise<{ status: PaymentStatus; estado_pago: PaymentStatus; transactionId?: string; reference?: string } | null> {
  try {
    const res = await fetch(`/api/payments/status/${encodeURIComponent(saleId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        status: data.status || data.estado_pago || "PENDIENTE",
        estado_pago: data.estado_pago || data.status || "PENDIENTE",
        transactionId: data.transactionId || data.gatewayReference,
        reference: data.transactionId || data.gatewayReference,
      };
    }
  } catch (err) {
    // Network or server offline
  }
  return null;
}

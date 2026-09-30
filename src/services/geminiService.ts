export const GEMINI_API_KEY_STORAGE = "cajamaster_gemini_api_key_v1";

export interface ProductAISuggestion {
  category: string;
  emoji: string;
  color: string;
  unit: string;
  suggestedCost: number;
  suggestedPrice: number;
  description?: string;
}

export interface StoredAIConfig {
  apiKey: string;
  enabled: boolean;
  model: string;
  lastTestedAt?: number;
}

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function setStoredApiKey(key: string): void {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
    }
  } catch (e) {
    console.error("Error saving Gemini API Key:", e);
  }
}

export function hasGeminiApiKey(): boolean {
  const key = getStoredApiKey();
  return Boolean(key && key.trim().length > 10);
}

/**
 * Universal Gemini request dispatcher:
 * 1. Tries server-side proxy route `/api/ai/*` (with @google/genai SDK on Node.js)
 * 2. Falls back to direct client REST API (for native Capacitor standalone apps)
 */
async function callGemini(
  endpoint: string,
  clientPrompt: string,
  systemInstruction?: string,
  jsonSchema?: any
): Promise<{ text: string; data?: any }> {
  const userKey = getStoredApiKey();

  // Try Server-side proxy route first
  try {
    const serverRes = await fetch(`/api/ai/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": userKey,
      },
      body: JSON.stringify({
        prompt: clientPrompt,
        systemInstruction,
        jsonSchema,
      }),
    });

    if (serverRes.ok) {
      const result = await serverRes.json();
      return result;
    }
  } catch {
    // If backend proxy is unreachable (e.g. native offline mobile WebView), fall through to direct REST API
  }

  // Direct REST API fallback using Google Gemini endpoints
  if (!userKey) {
    throw new Error("No hay una clave API de Google Gemini configurada en Ajustes.");
  }

  const modelName = "gemini-3.8-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(userKey)}`;

  const bodyPayload: any = {
    contents: [
      {
        parts: [{ text: clientPrompt }],
      },
    ],
  };

  if (systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  if (jsonSchema) {
    bodyPayload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: jsonSchema,
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || `Error HTTP ${response.status}`;
    throw new Error(`Error en Gemini API: ${errMsg}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (jsonSchema) {
    try {
      const parsed = JSON.parse(rawText);
      return { text: rawText, data: parsed };
    } catch {
      return { text: rawText };
    }
  }

  return { text: rawText };
}

/**
 * Validates the Gemini API key
 */
export async function testGeminiApiKey(keyToTest?: string): Promise<{ success: boolean; message: string }> {
  const key = keyToTest || getStoredApiKey();
  if (!key || key.trim().length < 10) {
    return { success: false, message: "Por favor introduce una clave API válida de Google Gemini." };
  }

  try {
    // Test simple generation
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(key.trim())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Responde únicamente 'OK' si esta clave es válida." }] }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message: err.error?.message || `Clave rechazada por Google (Código ${res.status})`,
      };
    }

    return { success: true, message: "¡Clave API de Gemini validada y operativa con éxito!" };
  } catch (err: any) {
    return { success: false, message: err.message || "Error de conexión al validar la clave API." };
  }
}

/**
 * AI Assistant for product creation: suggests category, emoji, color, unit, prices and margin
 */
export async function suggestProductDetails(
  productName: string,
  existingCategories: string[] = [],
  businessContext: string = "Comercio / Gastronomía"
): Promise<ProductAISuggestion> {
  const prompt = `Analiza el siguiente nombre de producto para un TPV / Punto de venta (${businessContext}): "${productName}".
Categorías existentes en el negocio: ${existingCategories.join(", ") || "General, Alimentos, Bebidas, Abarrotes, Limpieza, Electrónica, Servicios"}.

Devuelve un JSON estrictamente estructurado con:
- category: la categoría más apropiada (preferiblemente de las existentes si encaja).
- emoji: un emoji representativo y llamativo del producto.
- color: un color hexadecimal armónico (ej. #0E3A2F, #C0392B, #D4A24E, #3498DB, #E67E22, #8E44AD).
- unit: unidad de medida sugerida (ej. "u", "porción", "kg", "g", "lb", "L", "ml", "servicio").
- suggestedCost: estimación numérica orientativa de costo en moneda local CUP/USD (número positivo).
- suggestedPrice: estimación numérica orientativa de precio de venta sugerido (con margen del 25% al 45%).
- description: breve descripción comercial atractiva (máximo 1 frase).`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      category: { type: "STRING" },
      emoji: { type: "STRING" },
      color: { type: "STRING" },
      unit: { type: "STRING" },
      suggestedCost: { type: "NUMBER" },
      suggestedPrice: { type: "NUMBER" },
      description: { type: "STRING" },
    },
    required: ["category", "emoji", "color", "unit", "suggestedCost", "suggestedPrice"],
  };

  const response = await callGemini(
    "suggest-product",
    prompt,
    "Eres un asistente experto en gestión de inventarios y puntos de venta TPV.",
    jsonSchema
  );

  if (response.data) {
    return response.data as ProductAISuggestion;
  }

  // Fallback parsing
  try {
    return JSON.parse(response.text) as ProductAISuggestion;
  } catch {
    return {
      category: existingCategories[0] || "General",
      emoji: "📦",
      color: "#0E3A2F",
      unit: "u",
      suggestedCost: 0,
      suggestedPrice: 0,
    };
  }
}

/**
 * AI Natural Language Analyst for stock and sales performance
 */
export async function analyzeStockAndSales(
  userQuery: string,
  summaryContext: {
    periodLabel: string;
    totalSales: number;
    totalCost: number;
    grossProfit: number;
    marginPercent: number;
    topProducts?: Array<{ name: string; qty: number; total: number }>;
    lowStockProducts?: Array<{ name: string; stock: number; unit: string }>;
    businessName?: string;
  }
): Promise<string> {
  const prompt = `Actúa como consultor de negocios y analista financiero senior para el establecimiento "${summaryContext.businessName || "Comercio POS"}".

Datos analíticos del periodo actual (${summaryContext.periodLabel}):
- Importe Total Vendido: $${summaryContext.totalSales.toLocaleString()} CUP
- Costo Total de Mercancía: $${summaryContext.totalCost.toLocaleString()} CUP
- Ganancia Bruta: $${summaryContext.grossProfit.toLocaleString()} CUP (Margen: ${summaryContext.marginPercent.toFixed(1)}%)
- Productos más vendidos: ${summaryContext.topProducts?.map((p) => `${p.name} (${p.qty} u, $${p.total})`).join("; ") || "Varios"}
- Productos con alerta de stock bajo: ${summaryContext.lowStockProducts?.map((p) => `${p.name} (${p.stock} ${p.unit})`).join("; ") || "Ninguno en riesgo"}

Pregunta del administrador:
"${userQuery}"

Responde de forma clara, profesional, concisa (máximo 3 párrafos o puntos clave con emojis) y con recomendaciones prácticas orientadas a aumentar beneficios y optimizar el stock.`;

  const response = await callGemini(
    "analyze-stock",
    prompt,
    "Eres un analista financiero y de inventarios para pequeños y medianos comercios."
  );

  return response.text;
}

/**
 * AI WhatsApp Offer and Marketing Copywriter
 */
export async function generateWhatsAppOffer(
  products: Array<{ name: string; price: number; unit: string; category?: string }>,
  businessName: string = "Nuestro Negocio",
  promoGoal: string = "Oferta de la semana"
): Promise<string> {
  const productListStr = products
    .map((p) => `• ${p.name}: $${p.price} CUP / ${p.unit}`)
    .join("\n");

  const prompt = `Redacta un mensaje publicitario llamativo y profesional para WhatsApp promocionando los siguientes productos del negocio "${businessName}":

Objetivo de la promoción: ${promoGoal}

Lista de productos:
${productListStr}

Requisitos del mensaje:
- Título con emojis llamativos y gancho de atención.
- Estructura limpia y fácil de leer en pantallas de teléfono móvil.
- Precios claros.
- Llamada a la acción clara para hacer pedidos por WhatsApp o acudir al local.
- Incluir un toque de cercanía y cortesía.`;

  const response = await callGemini(
    "generate-offer",
    prompt,
    "Eres un redactor publicitario especializado en mensajes de ventas y ofertas para WhatsApp y redes sociales."
  );

  return response.text;
}

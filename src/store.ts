import { useEffect, useState, useCallback } from "react";
import type {
  AppState,
  Category,
  Product,
  Sale,
  SaleItem,
  Movement,
  MovementType,
  DailyClosing,
  CurrencyCode,
  ExchangeRates,
  ConnectivityMode,
  BusinessInfo,
  OpenAccount,
  PaymentMethod,
  PaymentStatus,
  GatewayPayload,
  DeliveryOrder,
  DeliveryDriver,
  DeliveryAgency,
  DeliveryStatus,
  DriverStatus,
  DeliveryOrderItem,
} from "./types";
import { DEFAULT_RATES } from "./utils/currency";
import { checkAndNotifyStockBreaches } from "./utils/notifications";
import { syncService } from "./services/multiDeviceSync";

const STORAGE_KEY = "cajamaster_state_v3";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat_general", name: "General", color: "#0E3A2F", icon: "📦" },
  { id: "cat_alimentos", name: "Alimentos", color: "#D4A24E", icon: "🍔" },
  { id: "cat_bebidas", name: "Bebidas", color: "#3498DB", icon: "🥤" },
  { id: "cat_servicios", name: "Servicios", color: "#8E44AD", icon: "⚡" },
];

export const TEMPLATE_PRESETS: Record<
  "gastronomia" | "retail" | "servicios" | "clean",
  { label: string; description: string; icon: string; categories: Category[]; defaultUnit: string }
> = {
  gastronomia: {
    label: "Gastronomía (Restaurantes, Bares, Cafeterías)",
    description: "Configurado para bebidas, porciones, platos, raciones y cuentas por mesa",
    icon: "🍽️",
    defaultUnit: "porción",
    categories: [
      { id: "cat_cafe", name: "Cafetería", color: "#6B3F1D", icon: "☕" },
      { id: "cat_bebidas", name: "Bebidas", color: "#3498DB", icon: "🥤" },
      { id: "cat_platos", name: "Platos Fuertes", color: "#D4A24E", icon: "🍽️" },
      { id: "cat_entrantes", name: "Entrantes & Tapas", color: "#E67E22", icon: "🥪" },
      { id: "cat_postres", name: "Postres", color: "#E84393", icon: "🍰" },
      { id: "cat_cocteles", name: "Coctelería & Bar", color: "#F1C40F", icon: "🍹" },
    ],
  },
  retail: {
    label: "Comercio Minorista / Retail (Minisuper, Tiendas)",
    description: "Optimizado para lectura de código de barras, unidades físicas y control de stock",
    icon: "🛒",
    defaultUnit: "u",
    categories: [
      { id: "cat_abarrotes", name: "Abarrotes", color: "#0E3A2F", icon: "🥫" },
      { id: "cat_lacteos", name: "Lácteos & Embutidos", color: "#D4A24E", icon: "🧀" },
      { id: "cat_snacks", name: "Snacks & Dulces", color: "#E67E22", icon: "🍪" },
      { id: "cat_bebidas_r", name: "Bebidas & Jugos", color: "#3498DB", icon: "🧃" },
      { id: "cat_aseo", name: "Aseo & Limpieza", color: "#16A085", icon: "🧼" },
      { id: "cat_ropa", name: "Ropa & Accesorios", color: "#8E44AD", icon: "👕" },
      { id: "cat_ferreteria", name: "Ferretería & Hogar", color: "#5D4037", icon: "🔧" },
    ],
  },
  servicios: {
    label: "Servicios Profesionales & Talleres",
    description: "Tarifas por hora, servicios, mano de obra y repuestos",
    icon: "💼",
    defaultUnit: "servicio",
    categories: [
      { id: "cat_servicios_gen", name: "Servicios Básicos", color: "#0E3A2F", icon: "💼" },
      { id: "cat_mano_obra", name: "Mano de Obra", color: "#D4A24E", icon: "🛠️" },
      { id: "cat_mantenimiento", name: "Mantenimiento", color: "#E67E22", icon: "⚡" },
      { id: "cat_repuestos", name: "Repuestos & Piezas", color: "#3498DB", icon: "🔩" },
      { id: "cat_asesoria", name: "Consultoría / Hora", color: "#8E44AD", icon: "📋" },
    ],
  },
  clean: {
    label: "Lienzo en Blanco (100% Personalizado)",
    description: "Comienza desde cero con categorías generales para configurar a tu medida",
    icon: "✨",
    defaultUnit: "u",
    categories: [
      { id: "cat_general", name: "General", color: "#0E3A2F", icon: "📦" },
    ],
  },
};

export const DEFAULT_DRIVERS: DeliveryDriver[] = [
  {
    id: "drv_1",
    name: "Carlos Mendoza",
    phone: "52345678",
    identityNumber: "92041512345",
    vehicleType: "MOTORCYCLE",
    licensePlate: "P-452109",
    status: "AVAILABLE",
    activeDeliveriesCount: 0,
    totalCompletedDeliveries: 14,
    totalFeesEarned: 4200,
    totalTipsEarned: 650,
    avatarEmoji: "🏍️",
    createdAt: Date.now() - 86400000 * 10,
    notes: "Repartidor principal de zona Vedado y Playa",
  },
  {
    id: "drv_2",
    name: "Yurisleidis Peña",
    phone: "53456789",
    identityNumber: "95112045678",
    vehicleType: "ELECTRIC_SCOOTER",
    licensePlate: "E-88321",
    status: "AVAILABLE",
    activeDeliveriesCount: 0,
    totalCompletedDeliveries: 8,
    totalFeesEarned: 2400,
    totalTipsEarned: 300,
    avatarEmoji: "⚡",
    createdAt: Date.now() - 86400000 * 5,
    notes: "Moto eléctrica Mishozuki, entregas rápidas centro",
  },
  {
    id: "drv_3",
    name: "Roberto Gómez",
    phone: "54567890",
    identityNumber: "88081298765",
    vehicleType: "BICYCLE",
    status: "OFF_DUTY",
    activeDeliveriesCount: 0,
    totalCompletedDeliveries: 22,
    totalFeesEarned: 5500,
    totalTipsEarned: 890,
    avatarEmoji: "🚲",
    createdAt: Date.now() - 86400000 * 20,
    notes: "Biciclo con caja térmica",
  },
];

export const DEFAULT_AGENCIES: DeliveryAgency[] = [
  {
    id: "ag_mandao",
    name: "Mandao Logistics",
    phone: "+53 78330000",
    email: "soporte@mandao.io",
    baseFee: 350,
    contactPerson: "Operaciones La Habana",
    websiteOrApp: "https://mandao.io",
    webhookUrl: "https://api.mandao.io/v1/deliveries/webhook",
    apiKey: "mdo_live_99f8a2b3c4d5",
    notes: "Cobertura en todos los municipios de la capital. Integración API activa.",
    active: true,
    totalOrdersDispatched: 19,
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: "ag_enzona",
    name: "EnZona Envíos",
    phone: "+53 78381122",
    email: "envios@enzona.net",
    baseFee: 300,
    contactPerson: "Despacho EnZona",
    websiteOrApp: "https://enzona.net",
    webhookUrl: "https://api.enzona.net/hub/dispatch",
    apiKey: "ez_auth_77a1122334455",
    notes: "Cobro automatizado por pasarela EnZona",
    active: true,
    totalOrdersDispatched: 12,
    createdAt: Date.now() - 86400000 * 15,
  },
  {
    id: "ag_habana_express",
    name: "Mensajería Express Habana",
    phone: "+53 58889900",
    email: "express@habanadelivery.cu",
    baseFee: 250,
    contactPerson: "Lic. Yanet Valdés",
    websiteOrApp: "https://habanadelivery.cu",
    notes: "Mensajeros independientes para corta y mediana distancia.",
    active: true,
    totalOrdersDispatched: 7,
    createdAt: Date.now() - 86400000 * 8,
  },
];

export const DEFAULT_DELIVERIES: DeliveryOrder[] = [
  {
    id: "del_1",
    orderNumber: 101,
    createdAt: Date.now() - 1000 * 60 * 18,
    updatedAt: Date.now() - 1000 * 60 * 5,
    customerName: "Alejandro Pérez",
    customerPhone: "52123456",
    customerAddress: "Calle 23 #456 e/ J e I, Apto 3B, Vedado",
    customerLocationUrl: "https://maps.google.com/?q=23.134,-82.385",
    notes: "Tocar el timbre del apto 3B en el 2do piso",
    status: "EN_RUTA",
    items: [
      { name: "Hamburguesa Especial Res", emoji: "🍔", qty: 2, price: 950, unit: "u" },
      { name: "Cerveza Cristal 350ml", emoji: "🍺", qty: 2, price: 400, unit: "u" },
    ],
    itemsSubtotal: 2700,
    deliveryFee: 300,
    tip: 100,
    total: 3100,
    paymentMethod: "transfermovil",
    paymentStatus: "COMPLETADO",
    assignmentType: "DRIVER",
    driverId: "drv_1",
    driverName: "Carlos Mendoza",
    estimatedMinutes: 20,
    dispatchedAt: Date.now() - 1000 * 60 * 5,
    source: "WHATSAPP",
  },
  {
    id: "del_2",
    orderNumber: 102,
    createdAt: Date.now() - 1000 * 60 * 10,
    updatedAt: Date.now() - 1000 * 60 * 10,
    customerName: "Beatriz Morales",
    customerPhone: "53887766",
    customerAddress: "Av. 5ta #11202 e/ 112 y 114, Playa",
    notes: "Llamar al llegar a la reja blanca",
    status: "PREPARACION",
    items: [
      { name: "Pizza Jamón y Queso Familiar", emoji: "🍕", qty: 1, price: 1200, unit: "u" },
      { name: "Refresco TuKola 1.5L", emoji: "🥤", qty: 1, price: 650, unit: "u" },
    ],
    itemsSubtotal: 1850,
    deliveryFee: 350,
    tip: 0,
    total: 2200,
    paymentMethod: "cash",
    paymentStatus: "PENDIENTE",
    assignmentType: "UNASSIGNED",
    source: "WHATSAPP",
  },
  {
    id: "del_3",
    orderNumber: 103,
    createdAt: Date.now() - 1000 * 60 * 3,
    updatedAt: Date.now() - 1000 * 60 * 3,
    customerName: "Dr. Ernesto Ramos",
    customerPhone: "54223344",
    customerAddress: "Calle L #302 e/ 19 y 21, Vedado (Clínica)",
    notes: "Entregar en recepción a nombre del Dr. Ramos",
    status: "NUEVO",
    items: [
      { name: "Sándwich Cubano Clásico", emoji: "🥪", qty: 2, price: 750, unit: "u" },
      { name: "Café Expreso Doble", emoji: "☕", qty: 2, price: 250, unit: "u" },
    ],
    itemsSubtotal: 2000,
    deliveryFee: 250,
    tip: 150,
    total: 2400,
    paymentMethod: "enzona",
    paymentStatus: "PENDIENTE",
    assignmentType: "UNASSIGNED",
    source: "PHONE",
  },
];

function buildCleanState(businessType: "gastronomia" | "retail" | "servicios" | "general" | "clean" = "general"): AppState {
  const presetKey = (businessType === "general" || businessType === "clean") ? "clean" : businessType;
  const categories = TEMPLATE_PRESETS[presetKey]?.categories || DEFAULT_CATEGORIES;

  return {
    business: {
      name: "Mi Comercio",
      owner: "",
      taxId: "",
      address: "",
      phone: "",
      email: "",
      headerSubtitle: "Punto de Venta",
      footerMessage: "¡Gracias por su compra! Vuelva pronto.",
      defaultTaxRate: 0,
      defaultTipRate: 0,
      businessType: businessType === "clean" ? "general" : businessType,
    },
    categories,
    products: [],
    sales: [],
    movements: [],
    closings: [],
    rates: DEFAULT_RATES,
    selectedCurrency: "CUP",
    connectivityMode: "offline",
    ticketSequence: 1,
    openAccounts: [
      {
        id: "acc_1",
        name: "Cuenta Principal",
        items: [],
        discount: 0,
        createdAt: Date.now(),
      },
    ],
    activeAccountId: "acc_1",
    deliveries: DEFAULT_DELIVERIES,
    drivers: DEFAULT_DRIVERS,
    deliveryAgencies: DEFAULT_AGENCIES,
    deliverySequence: 104,
  };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const base = buildCleanState();
        const accounts =
          Array.isArray(parsed.openAccounts) && parsed.openAccounts.length > 0
            ? parsed.openAccounts
            : base.openAccounts;
        const activeId =
          parsed.activeAccountId && accounts?.some((a: any) => a.id === parsed.activeAccountId)
            ? parsed.activeAccountId
            : accounts?.[0]?.id || "acc_1";

        // Category migration/recovery
        let categories: Category[] = Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories
          : DEFAULT_CATEGORIES;

        // Make sure products' categories are represented if any
        if (Array.isArray(parsed.products) && parsed.products.length > 0) {
          const catNames = new Set(categories.map((c) => c.name.toLowerCase()));
          parsed.products.forEach((p: Product) => {
            if (p.category && !catNames.has(p.category.toLowerCase())) {
              catNames.add(p.category.toLowerCase());
              categories.push({
                id: "cat_" + Math.random().toString(36).substring(2, 8),
                name: p.category,
                color: p.color || "#0E3A2F",
                icon: p.emoji || "📦",
              });
            }
          });
        }

        const loadedProducts: Product[] = Array.isArray(parsed.products) ? parsed.products : [];
        const prodMap = new Map(loadedProducts.map((p) => [p.id, p]));

        const rawMovements: Movement[] = Array.isArray(parsed.movements) ? parsed.movements : [];
        const enrichedMovements: Movement[] = rawMovements.map((m) => {
          const p = prodMap.get(m.productId);
          return {
            ...m,
            productName: m.productName || p?.name || "Producto",
            productEmoji: m.productEmoji || p?.emoji || "📦",
            productCategory: m.productCategory || p?.category || "General",
            productUnit: m.productUnit || p?.unit || "u",
            user: m.user || "Cajero",
            totalCost: m.totalCost !== undefined ? m.totalCost : m.qty * (m.unitCost || p?.cost || 0),
          };
        });

        // Delivery state recovery/defaults
        const deliveries: DeliveryOrder[] = Array.isArray(parsed.deliveries)
          ? parsed.deliveries
          : DEFAULT_DELIVERIES;
        const drivers: DeliveryDriver[] = Array.isArray(parsed.drivers) && parsed.drivers.length > 0
          ? parsed.drivers
          : DEFAULT_DRIVERS;
        const deliveryAgencies: DeliveryAgency[] = Array.isArray(parsed.deliveryAgencies) && parsed.deliveryAgencies.length > 0
          ? parsed.deliveryAgencies
          : DEFAULT_AGENCIES;
        const deliverySequence = typeof parsed.deliverySequence === "number"
          ? parsed.deliverySequence
          : 104;

        return {
          ...base,
          ...parsed,
          categories,
          products: loadedProducts,
          sales: Array.isArray(parsed.sales) ? parsed.sales : [],
          movements: enrichedMovements,
          closings: Array.isArray(parsed.closings) ? parsed.closings : [],
          openAccounts: accounts,
          activeAccountId: activeId,
          rates: { ...DEFAULT_RATES, ...(parsed.rates || {}) },
          business: { ...base.business, ...(parsed.business || {}) },
          deliveries,
          drivers,
          deliveryAgencies,
          deliverySequence,
        };
      }
    }
  } catch (err) {
    console.error("Error loading state:", err);
  }
  const s = buildCleanState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  return s;
}

let _state: AppState = loadState();
const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch (err) {
    console.error("Error saving state to localStorage:", err);
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.error("Failed to save state on beforeunload:", e);
    }
  });
  window.addEventListener("pagehide", () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.error("Failed to save state on pagehide:", e);
    }
  });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
      } catch (e) {
        console.error("Failed to save state on visibility hidden:", e);
      }
    }
  });
}

export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return _state;
}

function broadcastAccount(id?: string, actionType: "created" | "updated" = "updated") {
  const targetId = id || _state.activeAccountId;
  const acc = (_state.openAccounts || []).find((a) => a.id === targetId);
  if (acc) {
    syncService.broadcastAccountUpdate(acc, actionType);
  }
}

export const actions = {
  // Category actions (CRUD)
  addCategory(category: Omit<Category, "id"> | Category): Category {
    const newCat: Category = {
      ...category,
      id: "id" in category && category.id ? category.id : "cat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      name: category.name.trim(),
      color: category.color || "#0E3A2F",
      icon: category.icon || "📦",
    };
    // Avoid duplicate names case-insensitively
    const exists = _state.categories.find(
      (c) => c.name.toLowerCase() === newCat.name.toLowerCase() && c.id !== newCat.id
    );
    if (!exists) {
      _state = {
        ..._state,
        categories: [..._state.categories, newCat],
      };
      emit();
      syncService.broadcastCategoriesUpdate(_state.categories);
    }
    return newCat;
  },

  updateCategory(id: string, updates: Partial<Category>) {
    const prevCat = _state.categories.find((c) => c.id === id);
    _state = {
      ..._state,
      categories: _state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    };

    // If name changed, optionally update existing products with this category
    if (prevCat && updates.name && updates.name !== prevCat.name) {
      _state.products = _state.products.map((p) =>
        p.category === prevCat.name ? { ...p, category: updates.name!.trim() } : p
      );
    }

    emit();
    syncService.broadcastCategoriesUpdate(_state.categories);
  },

  deleteCategory(id: string, fallbackCategoryName = "General") {
    const catToDelete = _state.categories.find((c) => c.id === id);
    if (!catToDelete) return;

    // Remaining categories
    const remaining = _state.categories.filter((c) => c.id !== id);
    // If no remaining, create at least 1 default
    if (remaining.length === 0) {
      remaining.push({ id: "cat_general", name: "General", color: "#0E3A2F", icon: "📦" });
    }

    const replacement = fallbackCategoryName || remaining[0].name;

    // Update products that were assigned to the deleted category
    _state = {
      ..._state,
      categories: remaining,
      products: _state.products.map((p) =>
        p.category === catToDelete.name ? { ...p, category: replacement } : p
      ),
    };
    emit();
    syncService.broadcastCategoriesUpdate(_state.categories);
  },

  setCategories(categories: Category[]) {
    _state = {
      ..._state,
      categories: categories.length > 0 ? categories : DEFAULT_CATEGORIES,
    };
    emit();
    syncService.broadcastCategoriesUpdate(_state.categories);
  },

  applyBusinessPreset(presetKey: "gastronomia" | "retail" | "servicios" | "clean") {
    const preset = TEMPLATE_PRESETS[presetKey];
    if (!preset) return;
    _state = {
      ..._state,
      categories: preset.categories,
      business: {
        ..._state.business,
        businessType: presetKey === "clean" ? "general" : presetKey,
      },
    };
    emit();
    syncService.broadcastFullStateSnapshot(_state);
  },

  // Product actions
  addOrUpdateProduct(p: Product, isNew: boolean) {
    // Ensure product category is registered in categories list
    if (p.category) {
      const catExists = _state.categories.some(
        (c) => c.name.toLowerCase() === p.category.toLowerCase()
      );
      if (!catExists) {
        _state.categories = [
          ..._state.categories,
          {
            id: "cat_" + Date.now(),
            name: p.category.trim(),
            color: p.color || "#0E3A2F",
            icon: p.emoji || "📦",
          },
        ];
      }
    }

    if (isNew) {
      _state = { ..._state, products: [p, ..._state.products] };
      const initMovement: Movement = {
        id: "m_init_" + p.id + "_" + Date.now(),
        ts: Date.now(),
        productId: p.id,
        productName: p.name,
        productEmoji: p.emoji,
        productCategory: p.category,
        productUnit: p.unit,
        type: "INITIAL",
        qty: p.stock,
        previousStock: 0,
        resultingStock: p.stock,
        unitCost: p.cost,
        totalCost: p.cost * p.stock,
        user: "Administrador",
        reason: "Alta inicial de producto",
        notes: "Inventario inicial al registrar el producto en catálogo",
      };
      _state.movements = [initMovement, ..._state.movements];
    } else {
      const prev = _state.products.find((x) => x.id === p.id);
      _state = {
        ..._state,
        products: _state.products.map((x) => (x.id === p.id ? p : x)),
      };
      if (prev && p.stock !== prev.stock) {
        const diff = p.stock - prev.stock;
        const editMovement: Movement = {
          id: "m_edit_" + p.id + "_" + Date.now(),
          ts: Date.now(),
          productId: p.id,
          productName: p.name,
          productEmoji: p.emoji,
          productCategory: p.category,
          productUnit: p.unit,
          type: diff > 0 ? "ENTRY" : "ADJUST",
          qty: Math.abs(diff),
          previousStock: prev.stock,
          resultingStock: p.stock,
          unitCost: p.cost,
          totalCost: p.cost * Math.abs(diff),
          user: "Administrador",
          reason: diff > 0 ? "Reabastecimiento / Edición de catálogo" : "Ajuste directo de existencias",
          notes: `Modificación directa de catálogo (${prev.stock} -> ${p.stock} ${p.unit})`,
        };
        _state.movements = [editMovement, ..._state.movements];
      }
    }
    emit();
    syncService.broadcastProductUpdate(p);
  },

  deleteProduct(id: string) {
    _state = {
      ..._state,
      products: _state.products.filter((p) => p.id !== id),
    };
    emit();
    syncService.broadcastStockUpdate(id, 0);
  },

  adjustStock(
    productId: string,
    newStock: number,
    reason = "Ajuste manual",
    user = "Cajero",
    customType?: MovementType
  ) {
    const p = _state.products.find((x) => x.id === productId);
    if (!p) return;
    const diff = newStock - p.stock;
    if (diff === 0) return;

    const prevProducts = _state.products;
    const safeNewStock = Math.max(0, newStock);
    const updatedProducts = _state.products.map((x) =>
      x.id === productId ? { ...x, stock: safeNewStock } : x
    );

    const movType: MovementType = customType || (diff > 0 ? "ENTRY" : "ADJUST");

    const newMov: Movement = {
      id: "madj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      ts: Date.now(),
      productId,
      productName: p.name,
      productEmoji: p.emoji,
      productCategory: p.category,
      productUnit: p.unit,
      type: movType,
      qty: Math.abs(diff),
      previousStock: p.stock,
      resultingStock: safeNewStock,
      unitCost: p.cost,
      totalCost: p.cost * Math.abs(diff),
      user: user || "Cajero",
      reason: reason || (diff > 0 ? "Reabastecimiento de existencias" : "Ajuste de inventario"),
      notes: reason,
    };

    _state = {
      ..._state,
      products: updatedProducts,
      movements: [newMov, ..._state.movements],
    };
    emit();
    checkAndNotifyStockBreaches(prevProducts, updatedProducts);
    syncService.broadcastStockUpdate(productId, safeNewStock);
  },

  registerStockMovement(params: {
    productId: string;
    type: MovementType;
    qty: number;
    reason: string;
    notes?: string;
    user?: string;
    unitCost?: number;
  }) {
    const { productId, type, qty, reason, notes, user = "Cajero", unitCost } = params;
    const p = _state.products.find((x) => x.id === productId);
    if (!p || qty <= 0) return;

    const prevStock = p.stock;
    let newStock = prevStock;

    if (type === "ENTRY" || type === "INITIAL" || type === "RETURN") {
      newStock = prevStock + qty;
    } else if (type === "SALE" || type === "LOSS") {
      newStock = Math.max(0, prevStock - qty);
    } else if (type === "ADJUST") {
      newStock = Math.max(0, qty); // In explicit adjust mode, qty can represent target stock or diff
    }

    const resolvedCost = unitCost !== undefined && unitCost >= 0 ? unitCost : p.cost;
    const diffQty = type === "ADJUST" ? Math.abs(newStock - prevStock) : qty;

    const mov: Movement = {
      id: "mov_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      productId: p.id,
      productName: p.name,
      productEmoji: p.emoji,
      productCategory: p.category,
      productUnit: p.unit,
      type,
      qty: diffQty,
      previousStock: prevStock,
      resultingStock: newStock,
      unitCost: resolvedCost,
      totalCost: resolvedCost * diffQty,
      user,
      reason,
      notes: notes || reason,
    };

    const prevProducts = _state.products;
    const updatedProducts = _state.products.map((prod) =>
      prod.id === productId ? { ...prod, stock: newStock, cost: resolvedCost } : prod
    );

    _state = {
      ..._state,
      products: updatedProducts,
      movements: [mov, ..._state.movements],
    };

    emit();
    checkAndNotifyStockBreaches(prevProducts, updatedProducts);
    syncService.broadcastStockUpdate(productId, newStock);
    return mov;
  },

  // Account / Open Tab Actions ("Cuentas Abiertas / Mesas / Clientes")
  createAccount(customName?: string): string {
    const accounts = _state.openAccounts || [];
    const count = accounts.length + 1;
    const name = (customName && customName.trim()) || `Cuenta ${count}`;
    const newAcc: OpenAccount = {
      id: "acc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      name,
      items: [],
      discount: 0,
      createdAt: Date.now(),
    };
    _state = {
      ..._state,
      openAccounts: [...accounts, newAcc],
      activeAccountId: newAcc.id,
    };
    emit();
    syncService.broadcastAccountUpdate(newAcc, "created");
    return newAcc.id;
  },

  setActiveAccount(id: string) {
    const accounts = _state.openAccounts || [];
    if (accounts.some((a) => a.id === id)) {
      _state = { ..._state, activeAccountId: id };
      emit();
    }
  },

  renameAccount(id: string, newName: string) {
    const clean = newName.trim();
    if (!clean) return;
    const accounts = (_state.openAccounts || []).map((a) =>
      a.id === id ? { ...a, name: clean } : a
    );
    _state = { ..._state, openAccounts: accounts };
    emit();
    broadcastAccount(id, "updated");
  },

  deleteAccount(id: string) {
    const accounts = _state.openAccounts || [];
    const filtered = accounts.filter((a) => a.id !== id);
    if (filtered.length === 0) {
      const fresh: OpenAccount = {
        id: "acc_" + Date.now(),
        name: "Cuenta 1",
        items: [],
        discount: 0,
        createdAt: Date.now(),
      };
      _state = {
        ..._state,
        openAccounts: [fresh],
        activeAccountId: fresh.id,
      };
    } else {
      const nextActive =
        _state.activeAccountId === id ? filtered[0].id : _state.activeAccountId;
      _state = {
        ..._state,
        openAccounts: filtered,
        activeAccountId: nextActive,
      };
    }
    emit();
    syncService.broadcastAccountDelete(id);
  },

  addItemToActiveAccount(p: Product, qtyToAdd = 1) {
    if (p.stock <= 0) return;
    let accounts = _state.openAccounts && _state.openAccounts.length > 0 ? [..._state.openAccounts] : [];
    let activeId = _state.activeAccountId || accounts[0]?.id || "acc_1";

    if (accounts.length === 0 || !accounts.some((a) => a.id === activeId)) {
      const defaultAcc: OpenAccount = {
        id: activeId,
        name: "Cuenta 1",
        items: [],
        discount: 0,
        createdAt: Date.now(),
      };
      accounts = [defaultAcc, ...accounts.filter((a) => a.id !== activeId)];
    }

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id !== activeId) return acc;
      const existing = acc.items.find((i) => i.productId === p.id);
      let newItems: SaleItem[];
      if (existing) {
        const nextQty = Math.min(p.stock, existing.qty + qtyToAdd);
        newItems = acc.items.map((i) =>
          i.productId === p.id ? { ...i, qty: nextQty } : i
        );
      } else {
        const nextQty = Math.min(p.stock, qtyToAdd);
        newItems = [
          ...acc.items,
          {
            productId: p.id,
            name: p.name,
            emoji: p.emoji,
            image: p.image,
            unit: p.unit,
            price: p.price,
            cost: p.cost,
            qty: nextQty,
          },
        ];
      }
      return { ...acc, items: newItems };
    });

    _state = { ..._state, openAccounts: updatedAccounts, activeAccountId: activeId };
    emit();
    broadcastAccount(activeId, "updated");
  },

  setItemQtyInActiveAccount(productId: string, qty: number) {
    const p = _state.products.find((x) => x.id === productId);
    const maxStock = p ? p.stock : 999999;
    const accounts = _state.openAccounts || [];
    const activeId = _state.activeAccountId || accounts[0]?.id;

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id !== activeId) return acc;
      if (qty <= 0) {
        return { ...acc, items: acc.items.filter((i) => i.productId !== productId) };
      }
      const safeQty = Math.min(maxStock, qty);
      return {
        ...acc,
        items: acc.items.map((i) =>
          i.productId === productId ? { ...i, qty: safeQty } : i
        ),
      };
    });

    _state = { ..._state, openAccounts: updatedAccounts };
    emit();
    broadcastAccount(activeId, "updated");
  },

  decItemInActiveAccount(productId: string) {
    const accounts = _state.openAccounts || [];
    const activeId = _state.activeAccountId || accounts[0]?.id;

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id !== activeId) return acc;
      const newItems = acc.items.flatMap((i) => {
        if (i.productId !== productId) return [i];
        if (i.qty <= 1) return [];
        return [{ ...i, qty: i.qty - 1 }];
      });
      return { ...acc, items: newItems };
    });

    _state = { ..._state, openAccounts: updatedAccounts };
    emit();
    broadcastAccount(activeId, "updated");
  },

  removeItemFromActiveAccount(productId: string) {
    const accounts = _state.openAccounts || [];
    const activeId = _state.activeAccountId || accounts[0]?.id;

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id !== activeId) return acc;
      return {
        ...acc,
        items: acc.items.filter((i) => i.productId !== productId),
      };
    });

    _state = { ..._state, openAccounts: updatedAccounts };
    emit();
    broadcastAccount(activeId, "updated");
  },

  clearActiveAccount() {
    const accounts = _state.openAccounts || [];
    const activeId = _state.activeAccountId || accounts[0]?.id;

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id !== activeId) return acc;
      return { ...acc, items: [], discount: 0, notes: undefined, customerName: undefined };
    });

    _state = { ..._state, openAccounts: updatedAccounts };
    emit();
    broadcastAccount(activeId, "updated");
  },

  setDiscountInActiveAccount(discount: number) {
    const accounts = _state.openAccounts || [];
    const activeId = _state.activeAccountId || accounts[0]?.id;

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id !== activeId) return acc;
      return { ...acc, discount: Math.max(0, discount) };
    });

    _state = { ..._state, openAccounts: updatedAccounts };
    emit();
    broadcastAccount(activeId, "updated");
  },

  setNotesInActiveAccount(notes: string) {
    const accounts = _state.openAccounts || [];
    const activeId = _state.activeAccountId || accounts[0]?.id;

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id !== activeId) return acc;
      return { ...acc, notes: notes.trim() || undefined };
    });

    _state = { ..._state, openAccounts: updatedAccounts };
    emit();
    broadcastAccount(activeId, "updated");
  },

  setCustomerNameInActiveAccount(name: string) {
    const accounts = _state.openAccounts || [];
    const activeId = _state.activeAccountId || accounts[0]?.id;

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id !== activeId) return acc;
      return { ...acc, customerName: name.trim() || undefined };
    });

    _state = { ..._state, openAccounts: updatedAccounts };
    emit();
    broadcastAccount(activeId, "updated");
  },

  // Sales Registration
  registerSale(params: {
    items: SaleItem[];
    subtotal: number;
    discount?: number;
    total: number;
    paymentMethod: PaymentMethod;
    paymentStatus?: PaymentStatus;
    estado_pago?: PaymentStatus;
    gatewayReference?: string;
    gatewayPayload?: GatewayPayload;
    syncStatus?: "synced" | "pending_sync";
    cashPaid?: number;
    change?: number;
    currency: CurrencyCode;
    notes?: string;
  }): Sale {
    const {
      items,
      subtotal,
      discount = 0,
      total,
      paymentMethod,
      cashPaid,
      change,
      currency,
      notes,
      gatewayReference,
      gatewayPayload,
    } = params;

    // Default status logic: cash is immediately COMPLETADO.
    // Online gateways default to PENDIENTE unless explicitly provided otherwise.
    const resolvedStatus: PaymentStatus =
      params.paymentStatus ||
      params.estado_pago ||
      (paymentMethod === "cash" ? "COMPLETADO" : "PENDIENTE");

    const isOnline = _state.connectivityMode === "online" && (typeof navigator === "undefined" || navigator.onLine);
    const resolvedSyncStatus: "synced" | "pending_sync" =
      params.syncStatus || (isOnline ? "synced" : "pending_sync");

    const sale: Sale = {
      id: "s_" + Date.now(),
      ticketNumber: _state.ticketSequence,
      ts: Date.now(),
      items,
      subtotal,
      discount,
      total,
      paymentMethod,
      paymentStatus: resolvedStatus,
      estado_pago: resolvedStatus,
      gatewayReference,
      gatewayPayload,
      syncStatus: resolvedSyncStatus,
      cashPaid,
      change,
      currency,
      notes,
    };

    const prevProducts = _state.products;
    const saleMovements: Movement[] = [];

    const updatedProducts = _state.products.map((p) => {
      const it = items.find((i) => i.productId === p.id);
      if (it) {
        const nextStock = Math.max(0, p.stock - it.qty);
        saleMovements.push({
          id: `m_sale_${sale.id}_${p.id}_${Date.now()}`,
          ts: sale.ts,
          productId: p.id,
          productName: p.name,
          productEmoji: p.emoji,
          productCategory: p.category,
          productUnit: p.unit,
          type: "SALE",
          qty: it.qty,
          previousStock: p.stock,
          resultingStock: nextStock,
          unitCost: p.cost,
          totalCost: p.cost * it.qty,
          user: "Cajero",
          saleId: sale.id,
          ticketNumber: sale.ticketNumber,
          reason: `Venta Ticket #${sale.ticketNumber}`,
          notes: `Salida automática por Venta - Ticket #${sale.ticketNumber} (${sale.paymentMethod.toUpperCase()})`,
        });
        return { ...p, stock: nextStock };
      }
      return p;
    });

    // Clear active account after sale
    const accounts = _state.openAccounts || [];
    const activeId = _state.activeAccountId || accounts[0]?.id;
    let nextAccounts = accounts;
    let nextActiveId = activeId;

    if (accounts.length > 1) {
      // Remove closed account and activate first available
      nextAccounts = accounts.filter((a) => a.id !== activeId);
      nextActiveId = nextAccounts[0]?.id;
    } else {
      // Reset single account
      nextAccounts = accounts.map((a) =>
        a.id === activeId ? { ...a, items: [], discount: 0, notes: undefined, customerName: undefined } : a
      );
    }

    _state = {
      ..._state,
      sales: [sale, ..._state.sales],
      movements: [...saleMovements, ..._state.movements],
      products: updatedProducts,
      ticketSequence: _state.ticketSequence + 1,
      openAccounts: nextAccounts,
      activeAccountId: nextActiveId,
    };

    emit();
    checkAndNotifyStockBreaches(prevProducts, updatedProducts);
    syncService.broadcastNewSale(sale);
    return sale;
  },

  updateSalePaymentStatus(
    saleId: string,
    status: PaymentStatus,
    gatewayReference?: string
  ) {
    _state = {
      ..._state,
      sales: _state.sales.map((s) => {
        if (s.id !== saleId) return s;
        return {
          ...s,
          paymentStatus: status,
          estado_pago: status,
          gatewayReference: gatewayReference || s.gatewayReference,
          gatewayPayload: s.gatewayPayload
            ? {
                ...s.gatewayPayload,
                confirmedAt: status === "COMPLETADO" ? Date.now() : s.gatewayPayload.confirmedAt,
              }
            : undefined,
        };
      }),
    };
    emit();
  },

  markSalesSynced(saleIds: string[]) {
    const idSet = new Set(saleIds);
    _state = {
      ..._state,
      sales: _state.sales.map((s) => {
        if (idSet.has(s.id)) {
          return { ...s, syncStatus: "synced" };
        }
        return s;
      }),
    };
    emit();
  },

  // Daily Closing & Physical Inventory Count
  registerDailyClosing(closing: Omit<DailyClosing, "id" | "closedAt">): DailyClosing {
    const fullClosing: DailyClosing = {
      ...closing,
      id: "closing_" + Date.now(),
      closedAt: Date.now(),
    };

    const prevProducts = _state.products;
    const closingMovements: Movement[] = [];

    // Apply physical count adjustments if any
    const updatedProducts = _state.products.map((p) => {
      const match = closing.counts.find((c) => c.productId === p.id);
      if (match) {
        const diff = match.physicalStock - match.systemStock;
        if (diff !== 0) {
          closingMovements.push({
            id: `m_close_${fullClosing.id}_${p.id}_${Date.now()}`,
            ts: fullClosing.closedAt,
            productId: p.id,
            productName: p.name,
            productEmoji: p.emoji,
            productCategory: p.category,
            productUnit: p.unit,
            type: "PHYSICAL_COUNT",
            qty: Math.abs(diff),
            previousStock: match.systemStock,
            resultingStock: match.physicalStock,
            unitCost: p.cost,
            totalCost: p.cost * Math.abs(diff),
            user: fullClosing.cashier || "Responsable de Caja",
            reason: diff < 0 ? "Faltante / Merma Arqueo Z" : "Sobrante Físico Arqueo Z",
            notes: `Arqueo Físico Cierre Z: Sistema ${match.systemStock} ${p.unit} vs Físico ${match.physicalStock} ${p.unit} (Diferencia: ${diff > 0 ? "+" : ""}${diff} ${p.unit})`,
          });
        }
        return { ...p, stock: Math.max(0, match.physicalStock) };
      }
      return p;
    });

    _state = {
      ..._state,
      closings: [fullClosing, ..._state.closings],
      movements: [...closingMovements, ..._state.movements],
      products: updatedProducts,
    };

    emit();
    checkAndNotifyStockBreaches(prevProducts, updatedProducts);
    return fullClosing;
  },

  // Currency & Settings
  setSelectedCurrency(c: CurrencyCode) {
    _state = { ..._state, selectedCurrency: c };
    emit();
  },

  setExchangeRates(rates: ExchangeRates) {
    _state = { ..._state, rates: { ..._state.rates, ...rates } };
    emit();
  },

  setConnectivityMode(mode: ConnectivityMode) {
    _state = { ..._state, connectivityMode: mode };
    emit();
  },

  updateBusinessInfo(biz: Partial<BusinessInfo>) {
    _state = { ..._state, business: { ..._state.business, ...biz } };
    emit();
  },

  // Backup & Restore
  restoreBackup(data: AppState) {
    _state = {
      ...data,
      rates: { ...DEFAULT_RATES, ...(data.rates || {}) },
    };
    emit();
  },

  exportBackup() {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
    
    const exportPayload = {
      _app: "CajaMaster Pro",
      _version: "2.0.0",
      _exportedAt: d.toISOString(),
      _totalProducts: _state.products.length,
      _totalSales: _state.sales.length,
      _totalClosings: _state.closings.length,
      ..._state,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cajamaster_backup_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportSalesJson() {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    
    const exportPayload = {
      _app: "CajaMaster Pro",
      _type: "sales_history",
      _exportedAt: d.toISOString(),
      business: _state.business,
      rates: _state.rates,
      totalSalesCount: _state.sales.length,
      sales: _state.sales,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cajamaster_ventas_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportInventoryJson() {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    
    const exportPayload = {
      _app: "CajaMaster Pro",
      _type: "inventory_catalog",
      _exportedAt: d.toISOString(),
      business: _state.business,
      totalProductsCount: _state.products.length,
      products: _state.products,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cajamaster_inventario_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  resetData(businessType: "gastronomia" | "retail" | "servicios" | "general" | "clean" = "general") {
    localStorage.removeItem(STORAGE_KEY);
    _state = buildCleanState(businessType);
    emit();
    syncService.broadcastFullStateSnapshot(_state);
  },

  // Remote Synchronization Handlers (Inbound from other terminals)
  applyRemoteAccountUpdate(account: OpenAccount, _senderName?: string) {
    if (!account || !account.id) return;
    const accounts = _state.openAccounts || [];
    const index = accounts.findIndex((a) => a.id === account.id);
    let updatedAccounts: OpenAccount[];
    if (index >= 0) {
      updatedAccounts = accounts.map((a) => (a.id === account.id ? account : a));
    } else {
      updatedAccounts = [...accounts, account];
    }
    _state = { ..._state, openAccounts: updatedAccounts };
    emit();
  },

  applyRemoteAccountDelete(accountId: string) {
    if (!accountId) return;
    const accounts = _state.openAccounts || [];
    const filtered = accounts.filter((a) => a.id !== accountId);
    if (filtered.length === 0) {
      const fresh: OpenAccount = {
        id: "acc_" + Date.now(),
        name: "Cuenta 1",
        items: [],
        discount: 0,
        createdAt: Date.now(),
      };
      _state = {
        ..._state,
        openAccounts: [fresh],
        activeAccountId: fresh.id,
      };
    } else {
      const nextActive =
        _state.activeAccountId === accountId ? filtered[0].id : _state.activeAccountId;
      _state = {
        ..._state,
        openAccounts: filtered,
        activeAccountId: nextActive,
      };
    }
    emit();
  },

  applyRemoteSale(sale: Sale, _senderName?: string) {
    if (!sale || !sale.id) return;
    // Prevent duplicates
    if (_state.sales.some((s) => s.id === sale.id)) return;

    const prevProducts = _state.products;
    const updatedProducts = _state.products.map((p) => {
      const it = sale.items?.find((i) => i.productId === p.id);
      return it ? { ...p, stock: Math.max(0, p.stock - it.qty) } : p;
    });

    _state = {
      ..._state,
      sales: [sale, ..._state.sales],
      products: updatedProducts,
      ticketSequence: Math.max(_state.ticketSequence, (sale.ticketNumber || 0) + 1),
    };
    emit();
    checkAndNotifyStockBreaches(prevProducts, updatedProducts);
  },

  applyRemoteStock(productId: string, stock: number) {
    if (!productId || stock === undefined) return;
    const prevProducts = _state.products;
    const updatedProducts = _state.products.map((p) =>
      p.id === productId ? { ...p, stock: Math.max(0, stock) } : p
    );
    _state = { ..._state, products: updatedProducts };
    emit();
    checkAndNotifyStockBreaches(prevProducts, updatedProducts);
  },

  applyRemoteProduct(product: Product) {
    if (!product || !product.id) return;
    const exists = _state.products.some((p) => p.id === product.id);
    let updatedProducts: Product[];
    if (exists) {
      updatedProducts = _state.products.map((p) => (p.id === product.id ? product : p));
    } else {
      updatedProducts = [product, ..._state.products];
    }
    _state = { ..._state, products: updatedProducts };
    emit();
  },

  applyRemoteCategories(categories: Category[]) {
    if (!Array.isArray(categories) || categories.length === 0) return;
    _state = { ..._state, categories };
    emit();
  },

  applyRemoteFullState(remoteState: Partial<AppState>) {
    if (!remoteState) return;
    _state = {
      ..._state,
      categories: remoteState.categories && remoteState.categories.length > 0 ? remoteState.categories : _state.categories,
      products: remoteState.products && remoteState.products.length > 0 ? remoteState.products : _state.products,
      rates: remoteState.rates ? { ..._state.rates, ...remoteState.rates } : _state.rates,
      openAccounts: remoteState.openAccounts && remoteState.openAccounts.length > 0 ? remoteState.openAccounts : _state.openAccounts,
      business: remoteState.business ? { ..._state.business, ...remoteState.business } : _state.business,
      ticketSequence: remoteState.ticketSequence ? Math.max(_state.ticketSequence, remoteState.ticketSequence) : _state.ticketSequence,
      deliveries: remoteState.deliveries || _state.deliveries,
      drivers: remoteState.drivers || _state.drivers,
      deliveryAgencies: remoteState.deliveryAgencies || _state.deliveryAgencies,
    };
    emit();
  },

  // --- DELIVERIES & FLEET ACTIONS ---
  addDeliveryOrder(orderData: Partial<DeliveryOrder> & { customerName: string; customerAddress: string; items: DeliveryOrderItem[] }): DeliveryOrder {
    const seq = (_state.deliverySequence || 100) + 1;
    const itemsSubtotal = orderData.items.reduce((acc, it) => acc + (it.price * it.qty), 0);
    const deliveryFee = orderData.deliveryFee || 0;
    const tip = orderData.tip || 0;
    const total = orderData.total !== undefined ? orderData.total : (itemsSubtotal + deliveryFee + tip);

    const newOrder: DeliveryOrder = {
      id: "del_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      orderNumber: seq,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone || "",
      customerAddress: orderData.customerAddress,
      customerLocationUrl: orderData.customerLocationUrl,
      notes: orderData.notes,
      status: orderData.status || "NUEVO",
      items: orderData.items,
      itemsSubtotal,
      deliveryFee,
      tip,
      total,
      paymentMethod: orderData.paymentMethod || "cash",
      paymentStatus: orderData.paymentStatus || "PENDIENTE",
      assignmentType: orderData.assignmentType || "UNASSIGNED",
      driverId: orderData.driverId,
      driverName: orderData.driverName,
      agencyId: orderData.agencyId,
      agencyName: orderData.agencyName,
      trackingCode: orderData.trackingCode,
      estimatedMinutes: orderData.estimatedMinutes || 25,
      dispatchedAt: orderData.status === "EN_RUTA" ? Date.now() : undefined,
      deliveredAt: orderData.status === "ENTREGADO" ? Date.now() : undefined,
      source: orderData.source || "MANUAL",
      whatsappRawText: orderData.whatsappRawText,
    };

    const currentDeliveries = _state.deliveries || [];
    _state = {
      ..._state,
      deliveries: [newOrder, ...currentDeliveries],
      deliverySequence: seq,
    };

    if (newOrder.driverId && (newOrder.status === "EN_RUTA" || newOrder.status === "LISTO")) {
      const drivers = _state.drivers || [];
      _state.drivers = drivers.map((d) =>
        d.id === newOrder.driverId
          ? {
              ...d,
              status: newOrder.status === "EN_RUTA" ? "ON_ROUTE" : d.status,
              activeDeliveriesCount: d.activeDeliveriesCount + 1,
            }
          : d
      );
    }

    emit();
    return newOrder;
  },

  updateDeliveryOrder(id: string, updates: Partial<DeliveryOrder>) {
    const currentDeliveries = _state.deliveries || [];
    _state = {
      ..._state,
      deliveries: currentDeliveries.map((order) => {
        if (order.id !== id) return order;
        const updated = { ...order, ...updates, updatedAt: Date.now() };
        if (updates.items || updates.deliveryFee !== undefined || updates.tip !== undefined) {
          const itemsSubtotal = (updates.items || order.items).reduce((acc, it) => acc + (it.price * it.qty), 0);
          const deliveryFee = updates.deliveryFee !== undefined ? updates.deliveryFee : order.deliveryFee;
          const tip = updates.tip !== undefined ? updates.tip : (order.tip || 0);
          updated.itemsSubtotal = itemsSubtotal;
          updated.deliveryFee = deliveryFee;
          updated.tip = tip;
          updated.total = itemsSubtotal + deliveryFee + tip;
        }
        return updated;
      }),
    };
    emit();
  },

  updateDeliveryStatus(
    id: string,
    status: DeliveryStatus,
    driverId?: string,
    agencyId?: string,
    trackingCode?: string
  ) {
    const currentDeliveries = _state.deliveries || [];
    const targetOrder = currentDeliveries.find((o) => o.id === id);
    if (!targetOrder) return;

    let driverName = targetOrder.driverName;
    let agencyName = targetOrder.agencyName;
    let assignmentType = targetOrder.assignmentType;

    if (driverId) {
      const driver = (_state.drivers || []).find((d) => d.id === driverId);
      if (driver) {
        driverName = driver.name;
        assignmentType = "DRIVER";
      }
    } else if (agencyId) {
      const agency = (_state.deliveryAgencies || []).find((a) => a.id === agencyId);
      if (agency) {
        agencyName = agency.name;
        assignmentType = "AGENCY";
      }
    }

    const dispatchedAt = status === "EN_RUTA" ? (targetOrder.dispatchedAt || Date.now()) : targetOrder.dispatchedAt;
    const deliveredAt = status === "ENTREGADO" ? (targetOrder.deliveredAt || Date.now()) : targetOrder.deliveredAt;

    if (status === "ENTREGADO" && targetOrder.status !== "ENTREGADO") {
      const activeDriverId = driverId || targetOrder.driverId;
      if (activeDriverId) {
        const drivers = _state.drivers || [];
        _state.drivers = drivers.map((d) => {
          if (d.id === activeDriverId) {
            return {
              ...d,
              status: "AVAILABLE",
              activeDeliveriesCount: Math.max(0, d.activeDeliveriesCount - 1),
              totalCompletedDeliveries: d.totalCompletedDeliveries + 1,
              totalFeesEarned: d.totalFeesEarned + targetOrder.deliveryFee,
              totalTipsEarned: d.totalTipsEarned + (targetOrder.tip || 0),
            };
          }
          return d;
        });
      }

      const activeAgencyId = agencyId || targetOrder.agencyId;
      if (activeAgencyId) {
        const agencies = _state.deliveryAgencies || [];
        _state.deliveryAgencies = agencies.map((a) => {
          if (a.id === activeAgencyId) {
            return {
              ...a,
              totalOrdersDispatched: a.totalOrdersDispatched + 1,
            };
          }
          return a;
        });
      }
    }

    _state = {
      ..._state,
      deliveries: currentDeliveries.map((o) =>
        o.id === id
          ? {
              ...o,
              status,
              driverId: driverId !== undefined ? driverId : o.driverId,
              driverName,
              agencyId: agencyId !== undefined ? agencyId : o.agencyId,
              agencyName,
              trackingCode: trackingCode !== undefined ? trackingCode : o.trackingCode,
              assignmentType,
              dispatchedAt,
              deliveredAt,
              updatedAt: Date.now(),
            }
          : o
      ),
    };
    emit();
  },

  deleteDeliveryOrder(id: string) {
    const currentDeliveries = _state.deliveries || [];
    _state = {
      ..._state,
      deliveries: currentDeliveries.filter((o) => o.id !== id),
    };
    emit();
  },

  // Drivers Management
  addDeliveryDriver(driverData: Omit<DeliveryDriver, "id" | "createdAt" | "activeDeliveriesCount" | "totalCompletedDeliveries" | "totalFeesEarned" | "totalTipsEarned">): DeliveryDriver {
    const newDriver: DeliveryDriver = {
      ...driverData,
      id: "drv_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      activeDeliveriesCount: 0,
      totalCompletedDeliveries: 0,
      totalFeesEarned: 0,
      totalTipsEarned: 0,
      createdAt: Date.now(),
    };
    const currentDrivers = _state.drivers || [];
    _state = {
      ..._state,
      drivers: [...currentDrivers, newDriver],
    };
    emit();
    return newDriver;
  },

  updateDeliveryDriver(id: string, updates: Partial<DeliveryDriver>) {
    const currentDrivers = _state.drivers || [];
    _state = {
      ..._state,
      drivers: currentDrivers.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    };
    emit();
  },

  deleteDeliveryDriver(id: string) {
    const currentDrivers = _state.drivers || [];
    _state = {
      ..._state,
      drivers: currentDrivers.filter((d) => d.id !== id),
    };
    emit();
  },

  setDriverStatus(id: string, status: DriverStatus) {
    const currentDrivers = _state.drivers || [];
    _state = {
      ..._state,
      drivers: currentDrivers.map((d) => (d.id === id ? { ...d, status } : d)),
    };
    emit();
  },

  resetDriverEarnings(id: string) {
    const currentDrivers = _state.drivers || [];
    _state = {
      ..._state,
      drivers: currentDrivers.map((d) => (d.id === id ? { ...d, totalFeesEarned: 0, totalTipsEarned: 0 } : d)),
    };
    emit();
  },

  // Agencies Management
  addDeliveryAgency(agencyData: Omit<DeliveryAgency, "id" | "createdAt" | "totalOrdersDispatched">): DeliveryAgency {
    const newAgency: DeliveryAgency = {
      ...agencyData,
      id: "ag_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      totalOrdersDispatched: 0,
      createdAt: Date.now(),
    };
    const currentAgencies = _state.deliveryAgencies || [];
    _state = {
      ..._state,
      deliveryAgencies: [...currentAgencies, newAgency],
    };
    emit();
    return newAgency;
  },

  updateDeliveryAgency(id: string, updates: Partial<DeliveryAgency>) {
    const currentAgencies = _state.deliveryAgencies || [];
    _state = {
      ..._state,
      deliveryAgencies: currentAgencies.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    };
    emit();
  },

  deleteDeliveryAgency(id: string) {
    const currentAgencies = _state.deliveryAgencies || [];
    _state = {
      ..._state,
      deliveryAgencies: currentAgencies.filter((a) => a.id !== id),
    };
    emit();
  },
};

// Wire SyncService listeners to store actions
if (typeof window !== "undefined") {
  syncService.onRemoteAccount(({ account, senderName }) => {
    actions.applyRemoteAccountUpdate(account, senderName);
  });
  syncService.onRemoteAccountDelete(({ accountId }) => {
    actions.applyRemoteAccountDelete(accountId);
  });
  syncService.onRemoteSale(({ sale, senderName }) => {
    actions.applyRemoteSale(sale, senderName);
  });
  syncService.onRemoteStock(({ productId, stock }) => {
    actions.applyRemoteStock(productId, stock);
  });
  syncService.onRemoteProduct(({ product }) => {
    actions.applyRemoteProduct(product);
  });
  syncService.onRemoteCategories(({ categories }) => {
    actions.applyRemoteCategories(categories);
  });
  syncService.onRemoteSnapshot(({ state }) => {
    actions.applyRemoteFullState(state);
  });
  syncService.onStateRequested(() => {
    syncService.broadcastFullStateSnapshot(_state);
  });
  // Auto-start sync service on load
  setTimeout(() => {
    syncService.start();
  }, 100);
}

export function useTicket() {
  const store = useStore();
  const accounts = store.openAccounts || [];
  let active = accounts.find((a) => a.id === store.activeAccountId);
  if (!active && accounts.length > 0) {
    active = accounts[0];
  }
  const currentAccount = active || {
    id: "acc_1",
    name: "Cuenta 1",
    items: [],
    discount: 0,
    createdAt: Date.now(),
  };

  const items = currentAccount.items || [];
  const discount = currentAccount.discount || 0;
  const subtotal = items.reduce((a, b) => a + b.qty * b.price, 0);
  const total = Math.max(0, subtotal - discount);

  const add = useCallback((p: Product, qtyToAdd = 1) => {
    actions.addItemToActiveAccount(p, qtyToAdd);
  }, []);

  const setItemQty = useCallback((id: string, qty: number) => {
    actions.setItemQtyInActiveAccount(id, qty);
  }, []);

  const dec = useCallback((id: string) => {
    actions.decItemInActiveAccount(id);
  }, []);

  const remove = useCallback((id: string) => {
    actions.removeItemFromActiveAccount(id);
  }, []);

  const clear = useCallback(() => {
    actions.clearActiveAccount();
  }, []);

  const setDiscount = useCallback((d: number) => {
    actions.setDiscountInActiveAccount(d);
  }, []);

  const setNotes = useCallback((n: string) => {
    actions.setNotesInActiveAccount(n);
  }, []);

  const setCustomerName = useCallback((n: string) => {
    actions.setCustomerNameInActiveAccount(n);
  }, []);

  const createAccount = useCallback((name?: string) => {
    return actions.createAccount(name);
  }, []);

  const switchAccount = useCallback((id: string) => {
    actions.setActiveAccount(id);
  }, []);

  const renameAccount = useCallback((id: string, name: string) => {
    actions.renameAccount(id, name);
  }, []);

  const deleteAccount = useCallback((id: string) => {
    actions.deleteAccount(id);
  }, []);

  return {
    account: currentAccount,
    accounts,
    activeAccountId: currentAccount.id,
    items,
    add,
    dec,
    setItemQty,
    remove,
    clear,
    subtotal,
    discount,
    setDiscount,
    total,
    notes: currentAccount.notes || "",
    setNotes,
    customerName: currentAccount.customerName || "",
    setCustomerName,
    createAccount,
    switchAccount,
    renameAccount,
    deleteAccount,
  };
}

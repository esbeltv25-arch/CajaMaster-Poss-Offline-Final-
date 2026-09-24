export type CurrencyCode = "CUP" | "USD" | "EUR" | "MLC";

export interface ExchangeRates {
  CUP: number; // base: 1
  USD: number; // e.g. 350
  EUR: number; // e.g. 370
  MLC: number; // e.g. 300
}

export type Product = {
  id: string;
  name: string;
  category: string;
  emoji: string; // fallback icon
  image?: string; // base64 / data URL captured with camera or uploaded
  color: string; // tile accent color
  stock: number;
  price: number; // base price in CUP
  cost: number; // base purchase cost in CUP (for IPV and margin)
  unit: string; // U/M (e.g., "u", "kg", "L", "pq")
  active: boolean;
  lowStockAlert: number;
  barcode?: string;
  createdAt: number;
};

export type SaleItem = {
  productId: string;
  name: string;
  emoji?: string;
  image?: string;
  unit: string;
  qty: number;
  price: number; // in CUP
  cost: number; // in CUP
};

export type PaymentMethod =
  | "cash"
  | "transfermovil"
  | "enzona"
  | "transfer"
  | "mixed";

export type PaymentStatus = "COMPLETADO" | "PENDIENTE" | "FALLIDO" | "CANCELADO";

export type GatewayPayload = {
  provider: "transfermovil" | "enzona" | "manual" | "mixed";
  transactionId?: string;
  deepLinkUrl?: string;
  ussdCode?: string;
  qrCodeData?: string;
  phone?: string;
  accountNumber?: string;
  concept?: string;
  initiatedAt?: number;
  confirmedAt?: number;
  rawResponse?: Record<string, unknown>;
};

export type Sale = {
  id: string;
  ticketNumber: number;
  ts: number;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number; // in CUP
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus; // Standard state: COMPLETADO | PENDIENTE | FALLIDO | CANCELADO
  estado_pago?: PaymentStatus; // Spanish alias matching backend/business requirements
  gatewayReference?: string;
  gatewayPayload?: GatewayPayload;
  syncStatus?: "synced" | "pending_sync";
  cashPaid?: number;
  change?: number;
  currency: CurrencyCode;
  notes?: string;
};

export type MovementType =
  | "ENTRY"          // Entrada / Reabastecimiento / Compra (+)
  | "SALE"           // Salida por Venta / Ticket (-)
  | "LOSS"           // Salida por Merma / Rotura / Pérdida (-)
  | "ADJUST"         // Ajuste manual de stock (+/-)
  | "INITIAL"        // Stock inicial por alta de producto (+)
  | "PHYSICAL_COUNT" // Ajuste por Arqueo / Cierre Z (+/-)
  | "RETURN";        // Devolución / Reingreso (+)

export type Movement = {
  id: string;
  ts: number;
  productId: string;
  productName?: string;
  productEmoji?: string;
  productCategory?: string;
  productUnit?: string;
  type: MovementType;
  qty: number; // positive quantity moved
  previousStock?: number;
  resultingStock?: number;
  unitCost: number;
  totalCost?: number;
  notes?: string;
  reason?: string;
  user?: string; // e.g. "Cajero", "Administrador", "Sistema POS", "Cierre Z"
  saleId?: string;
  ticketNumber?: number;
};

export type PhysicalCountItem = {
  productId: string;
  name: string;
  unit: string;
  systemStock: number;
  physicalStock: number;
  discrepancy: number; // physicalStock - systemStock
  cost: number;
  price: number;
};

export type DailyClosing = {
  id: string;
  date: string; // YYYY-MM-DD
  closedAt: number;
  openingCash: number; // Fondo de caja inicial
  cashSales: number; // Ventas en efectivo
  transferSales: number; // Ventas por transferencia
  totalSales: number;
  totalTickets: number;
  countedCash: number; // Efectivo real contado
  cashDiscrepancy: number; // countedCash - (openingCash + cashSales)
  inventoryUnitsCounted: number;
  inventoryTotalCost: number;
  inventoryTotalValue: number;
  counts: PhysicalCountItem[];
  notes?: string;
  cashier?: string;
};

export type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

export type BusinessInfo = {
  name: string;
  owner: string;
  taxId?: string; // NIT / RUC / Licencia comercial
  address: string;
  phone: string;
  email?: string;
  headerSubtitle?: string;
  footerMessage: string;
  defaultTaxRate?: number; // % de impuesto opcional
  defaultTipRate?: number; // % de propina opcional
  businessType?: "gastronomia" | "retail" | "servicios" | "general";
};

export type ConnectivityMode = "offline" | "online";

export type DeviceRole = "primary" | "secondary";
export type SyncConnectionMode = "local" | "cloud";
export type SyncConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  role: DeviceRole;
  mode: SyncConnectionMode;
  joinedAt: number;
  lastPing: number;
  ip?: string;
  isSelf?: boolean;
}

export interface SyncConfig {
  enabled: boolean;
  role: DeviceRole;
  connectionMode: SyncConnectionMode;
  roomKey: string;
  deviceName: string;
  serverHost?: string; // Custom IP or host for local Wi-Fi e.g. "192.168.1.50:3000"
  autoSyncOnChanges: boolean;
}

export type SyncEventType =
  | "account:update"
  | "account:delete"
  | "sale:new"
  | "stock:update"
  | "product:update"
  | "category:update"
  | "state:snapshot"
  | "state:request";

export interface SyncNetworkEvent {
  type: SyncEventType;
  roomKey: string;
  senderId: string;
  senderName: string;
  senderRole: DeviceRole;
  timestamp: number;
  payload: any;
}

export type OpenAccount = {
  id: string;
  name: string; // e.g. "Cuenta Principal", "Mesa 1", "Barra", "Para Llevar"
  items: SaleItem[];
  discount: number;
  customerName?: string;
  createdAt: number;
  notes?: string;
};

export type PrinterConnectionType = "bluetooth" | "wifi" | "usb" | "ethernet" | "system";
export type PrinterPaperWidth = "58mm" | "80mm";

export interface PrinterDevice {
  id: string;
  name: string;
  connectionType: PrinterConnectionType;
  paperWidth: PrinterPaperWidth;
  ipAddress?: string;
  port?: number;
  bluetoothServiceUuid?: string;
  usbVendorId?: number;
  usbProductId?: number;
  autoCut?: boolean;
  openCashDrawer?: boolean;
  isDefault?: boolean;
  createdAt: number;
}

export interface PrinterSettings {
  defaultPrinterId: string | null;
  printers: PrinterDevice[];
  autoOpenSelectorIfNoDefault: boolean;
  autoPrintOnFinishSale: boolean;
  headerGraphicOrEmoji: boolean;
  lineFeedCount: number;
}

export type DeliveryStatus =
  | "NUEVO"
  | "PREPARACION"
  | "LISTO"
  | "EN_RUTA"
  | "ENTREGADO"
  | "CANCELADO";

export type VehicleType =
  | "MOTORCYCLE"
  | "BICYCLE"
  | "CAR"
  | "ELECTRIC_SCOOTER"
  | "WALK";

export type DriverStatus = "AVAILABLE" | "ON_ROUTE" | "OFF_DUTY";

export type DeliveryAssignmentType = "DRIVER" | "AGENCY" | "UNASSIGNED";

export interface DeliveryOrderItem {
  productId?: string;
  name: string;
  emoji?: string;
  qty: number;
  price: number; // in CUP
  unit?: string;
  notes?: string;
}

export interface DeliveryOrder {
  id: string;
  orderNumber: number;
  createdAt: number;
  updatedAt: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLocationUrl?: string;
  notes?: string;
  status: DeliveryStatus;
  items: DeliveryOrderItem[];
  itemsSubtotal: number; // in CUP
  deliveryFee: number; // in CUP
  tip?: number; // in CUP
  total: number; // in CUP
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  assignmentType: DeliveryAssignmentType;
  driverId?: string;
  driverName?: string;
  agencyId?: string;
  agencyName?: string;
  trackingCode?: string;
  estimatedMinutes?: number;
  dispatchedAt?: number;
  deliveredAt?: number;
  source: "WHATSAPP" | "MANUAL" | "ONLINE_WEB" | "PHONE";
  whatsappRawText?: string;
  linkedSaleId?: string;
}

export interface DeliveryDriver {
  id: string;
  name: string;
  phone: string;
  identityNumber: string;
  vehicleType: VehicleType;
  licensePlate?: string;
  status: DriverStatus;
  activeDeliveriesCount: number;
  totalCompletedDeliveries: number;
  totalFeesEarned: number;
  totalTipsEarned: number;
  avatarEmoji?: string;
  createdAt: number;
  notes?: string;
}

export interface DeliveryAgency {
  id: string;
  name: string;
  phone: string;
  email?: string;
  baseFee: number;
  contactPerson?: string;
  websiteOrApp?: string;
  webhookUrl?: string;
  apiKey?: string;
  notes?: string;
  active: boolean;
  totalOrdersDispatched: number;
  createdAt: number;
}

export type AppState = {
  business: BusinessInfo;
  categories: Category[];
  products: Product[];
  sales: Sale[];
  movements: Movement[];
  closings: DailyClosing[];
  rates: ExchangeRates;
  selectedCurrency: CurrencyCode;
  connectivityMode: ConnectivityMode;
  ticketSequence: number;
  openAccounts?: OpenAccount[];
  activeAccountId?: string;
  deliveries?: DeliveryOrder[];
  drivers?: DeliveryDriver[];
  deliveryAgencies?: DeliveryAgency[];
  deliverySequence?: number;
};

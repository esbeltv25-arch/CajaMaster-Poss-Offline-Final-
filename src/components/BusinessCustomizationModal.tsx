import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  IconCheck,
  IconSparkles,
  IconPrinter,
  IconReceipt,
  IconSliders,
  IconLayers,
  IconTag,
  IconCoins,
  IconBox,
  IconHelp,
  IconRefreshCw,
} from "./Icons";
import { useStore, actions, SECTOR_TAXONOMIES, DEFAULT_TAXONOMY, DEFAULT_BUSINESS_INFO } from "../store";
import type { BusinessInfo, BusinessTaxonomy, CurrencyCode } from "../types";
import { buildSaleReceiptText } from "../services/printerService";

export interface BusinessCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = "identity" | "taxonomy" | "ticket" | "taxes" | "preview";

export function BusinessCustomizationModal({
  isOpen,
  onClose,
}: BusinessCustomizationModalProps) {
  const state = useStore();
  const [activeTab, setActiveTab] = useState<TabKey>("identity");

  // Form State initialized with current business info
  const [bizForm, setBizForm] = useState<BusinessInfo>(() => ({
    ...DEFAULT_BUSINESS_INFO,
    ...state.business,
    taxonomy: {
      ...DEFAULT_TAXONOMY,
      ...(state.business?.taxonomy || {}),
    },
  }));

  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("58mm");
  const [savedToast, setSavedToast] = useState(false);
  const [presetToast, setPresetToast] = useState<string | null>(null);

  // Sync state whenever modal opens or global store changes
  useEffect(() => {
    if (isOpen) {
      setBizForm({
        ...DEFAULT_BUSINESS_INFO,
        ...state.business,
        taxonomy: {
          ...DEFAULT_TAXONOMY,
          ...(state.business?.taxonomy || {}),
        },
      });
    }
  }, [isOpen, state.business]);

  // Handle Sector Quick Preset Application
  const handleApplySectorTaxonomy = (sector: "gastronomia" | "retail" | "servicios" | "general") => {
    const selectedTaxonomy = SECTOR_TAXONOMIES[sector] || DEFAULT_TAXONOMY;
    const sectorName =
      sector === "gastronomia"
        ? "Gastronomía (Restaurante / Bar / Cafetería)"
        : sector === "retail"
        ? "Comercio Minorista (Tienda / Minisuper)"
        : sector === "servicios"
        ? "Servicios Profesionales & Talleres"
        : "General / Comercio";

    setBizForm((prev) => ({
      ...prev,
      businessType: sector,
      headerSubtitle:
        prev.headerSubtitle ||
        (sector === "gastronomia"
          ? "Especialistas en Gastronomía & Coctelería"
          : sector === "retail"
          ? "Comercio Minorista & Autoservicio"
          : sector === "servicios"
          ? "Servicios Técnicos & Profesionales"
          : "Punto de Venta"),
      taxonomy: {
        ...selectedTaxonomy,
      },
    }));

    setPresetToast(`¡Vocabulario adaptado para: ${sectorName}!`);
    setTimeout(() => setPresetToast(null), 3000);
  };

  const handleRestoreDefaults = () => {
    if (window.confirm("¿Restablecer toda la configuración y taxonomía a los valores estándar de fábrica?")) {
      setBizForm({ ...DEFAULT_BUSINESS_INFO });
      setPresetToast("Valores estándar restablecidos.");
      setTimeout(() => setPresetToast(null), 3000);
    }
  };

  const handleSaveAndApply = () => {
    const cleanedBusiness: BusinessInfo = {
      ...bizForm,
      name: bizForm.name.trim() || "Mi Comercio POS",
      owner: bizForm.owner.trim(),
      taxId: bizForm.taxId?.trim(),
      address: bizForm.address.trim(),
      phone: bizForm.phone.trim(),
      email: bizForm.email?.trim(),
      website: bizForm.website?.trim(),
      headerSubtitle: bizForm.headerSubtitle?.trim(),
      footerMessage: bizForm.footerMessage.trim() || "¡Gracias por su compra!",
      returnPolicy: bizForm.returnPolicy?.trim(),
      wifiInfo: bizForm.wifiInfo?.trim(),
      defaultTaxRate: typeof bizForm.defaultTaxRate === "number" ? Math.max(0, bizForm.defaultTaxRate) : 0,
      taxLabel: bizForm.taxLabel?.trim() || "Impuesto (IVA)",
      defaultTipRate: typeof bizForm.defaultTipRate === "number" ? Math.max(0, bizForm.defaultTipRate) : 0,
      tipLabel: bizForm.tipLabel?.trim() || "Propina / Servicio",
      taxonomy: {
        accountsLabel: bizForm.taxonomy?.accountsLabel?.trim() || "Mesas / Cuentas",
        accountSingular: bizForm.taxonomy?.accountSingular?.trim() || "Mesa",
        productsLabel: bizForm.taxonomy?.productsLabel?.trim() || "Productos",
        productSingular: bizForm.taxonomy?.productSingular?.trim() || "Producto",
        checkoutActionLabel: bizForm.taxonomy?.checkoutActionLabel?.trim() || "Cobrar",
        ticketDocumentLabel: bizForm.taxonomy?.ticketDocumentLabel?.trim() || "Ticket de Venta",
        cashierRoleLabel: bizForm.taxonomy?.cashierRoleLabel?.trim() || "Vendedor / Cajero",
        inventorySectionLabel: bizForm.taxonomy?.inventorySectionLabel?.trim() || "Stock / Almacén",
      },
    };

    actions.updateBusinessInfo(cleanedBusiness);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 1200);
  };

  // Mock sale for live thermal receipt preview
  const livePreviewText = useMemo(() => {
    const dummySale = {
      id: "demo_1001",
      ticketNumber: 1042,
      ts: Date.now(),
      items: [
        { productId: "p1", name: bizForm.taxonomy?.productSingular ? `${bizForm.taxonomy.productSingular} Especial` : "Café Expreso Doble", qty: 2, price: 250, cost: 100, unit: "u" },
        { productId: "p2", name: "Sándwich Gourmet", qty: 1, price: 950, cost: 400, unit: "u" },
      ],
      subtotal: 1450,
      discount: 0,
      total: 1450,
      paymentMethod: "cash" as const,
      paymentStatus: "COMPLETADO" as const,
      cashPaid: 2000,
      change: 550,
      currency: "CUP" as CurrencyCode,
    };

    return buildSaleReceiptText(dummySale, bizForm, state.rates, paperWidth);
  }, [bizForm, state.rates, paperWidth]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="business-customization-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          key="business-customization-modal"
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 my-auto text-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                <IconSparkles size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-extrabold text-sm sm:text-base leading-tight text-white">
                    Personalización del Negocio & Marca Blanca
                  </h2>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Pro
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Adapta textos, taxonomía, tickets térmicos, divisas e impuestos a tu modelo comercial
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer transition"
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
            {[
              { key: "identity", label: "1. Identidad", icon: <IconTag size={13} /> },
              { key: "taxonomy", label: "2. Vocabulario & Nicho", icon: <IconLayers size={13} /> },
              { key: "ticket", label: "3. Ticket & Políticas", icon: <IconReceipt size={13} /> },
              { key: "taxes", label: "4. Impuestos", icon: <IconCoins size={13} /> },
              { key: "preview", label: "5. Vista Previa Ticket", icon: <IconPrinter size={13} /> },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                  activeTab === tab.key
                    ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/10"
                    : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/60"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Toast Notification Alert */}
          {presetToast && (
            <div className="p-2.5 bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-between shadow-xs shrink-0 animate-pop">
              <div className="flex items-center gap-2">
                <IconCheck size={15} />
                <span>{presetToast}</span>
              </div>
              <button onClick={() => setPresetToast(null)} className="font-bold text-xs">✕</button>
            </div>
          )}

          {savedToast && (
            <div className="p-2.5 bg-emerald-600 text-white text-xs font-black flex items-center justify-between shadow-xs shrink-0 animate-pop">
              <div className="flex items-center gap-2">
                <IconCheck size={15} />
                <span>¡Cambios de marca blanca guardados y aplicados en toda la aplicación!</span>
              </div>
            </div>
          )}

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0">
            {/* TAB 1: IDENTIDAD & DATOS FISCALES */}
            {activeTab === "identity" && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-950 flex items-start gap-2.5">
                  <IconHelp size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Estos datos aparecerán en el encabezado oficial de tickets térmicos, arqueos Z, informes IPVE y documentos compartidos a clientes.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Nombre Comercial / Marca Blanca *
                    </label>
                    <input
                      type="text"
                      value={bizForm.name}
                      onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                      placeholder="Ej. Café & Bistró Habana / Tienda Express"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-extrabold outline-none text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Slogan / Subtítulo Comercial
                    </label>
                    <input
                      type="text"
                      value={bizForm.headerSubtitle || ""}
                      onChange={(e) => setBizForm({ ...bizForm, headerSubtitle: e.target.value })}
                      placeholder="Ej. Especialistas en Gastronomía Gourmet"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Titular / Propietario / Administrador
                    </label>
                    <input
                      type="text"
                      value={bizForm.owner}
                      onChange={(e) => setBizForm({ ...bizForm, owner: e.target.value })}
                      placeholder="Ej. Roberto Gómez"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      NIF / CIF / NIT / RUC / Licencia Comercial
                    </label>
                    <input
                      type="text"
                      value={bizForm.taxId || ""}
                      onChange={(e) => setBizForm({ ...bizForm, taxId: e.target.value })}
                      placeholder="Ej. NIT-940215-4521 / B-12345678"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Teléfono / WhatsApp de Atención
                    </label>
                    <input
                      type="text"
                      value={bizForm.phone}
                      onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                      placeholder="Ej. +53 52123456"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Correo Electrónico Comercial
                    </label>
                    <input
                      type="email"
                      value={bizForm.email || ""}
                      onChange={(e) => setBizForm({ ...bizForm, email: e.target.value })}
                      placeholder="Ej. contacto@mibistro.com"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                    Dirección Física del Establecimiento
                  </label>
                  <input
                    type="text"
                    value={bizForm.address}
                    onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                    placeholder="Ej. Calle 23 #456 e/ J e I, Vedado, La Habana"
                    className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Sitio Web / Redes Sociales
                    </label>
                    <input
                      type="text"
                      value={bizForm.website || ""}
                      onChange={(e) => setBizForm({ ...bizForm, website: e.target.value })}
                      placeholder="Ej. www.negocio.com / @minegocio"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Wi-Fi de Cortesía para el Cliente (Ticket)
                    </label>
                    <input
                      type="text"
                      value={bizForm.wifiInfo || ""}
                      onChange={(e) => setBizForm({ ...bizForm, wifiInfo: e.target.value })}
                      placeholder="Ej. Red: Cafe_WiFi / Clave: cafe2026"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: VOCABULARIO & TAXONOMÍA DEL NEGOCIO */}
            {activeTab === "taxonomy" && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-2">
                    Adaptar Terminología según el Tipo de Negocio
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { key: "gastronomia", label: "Gastronomía", icon: "🍽️", desc: "Mesas, Platos, Comandas" },
                      { key: "retail", label: "Retail / Tienda", icon: "🛒", desc: "Mostrador, Artículos, Ventas" },
                      { key: "servicios", label: "Servicios / Taller", icon: "💼", desc: "Clientes, Tarifas, Facturar" },
                      { key: "general", label: "Estándar / General", icon: "✨", desc: "Cuentas, Productos, Cobrar" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleApplySectorTaxonomy(item.key as any)}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer active:scale-95 ${
                          bizForm.businessType === item.key
                            ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
                        }`}
                      >
                        <div className="text-xl mb-1">{item.icon}</div>
                        <div className="font-extrabold text-xs leading-tight mb-0.5">{item.label}</div>
                        <div className={`text-[10px] ${bizForm.businessType === item.key ? "text-slate-300" : "text-slate-500"}`}>
                          {item.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <div className="text-xs font-extrabold text-slate-900">
                    Ajuste Fino de Términos (UI & Botones):
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                        Término para Mesas / Cuentas (Plural):
                      </label>
                      <input
                        type="text"
                        value={bizForm.taxonomy?.accountsLabel || ""}
                        onChange={(e) =>
                          setBizForm({
                            ...bizForm,
                            taxonomy: { ...bizForm.taxonomy, accountsLabel: e.target.value },
                          })
                        }
                        placeholder="Ej. Mesas, Comandas, Mostrador, Habitaciones"
                        className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-bold outline-none text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                        Término para Mesa / Cuenta (Singular):
                      </label>
                      <input
                        type="text"
                        value={bizForm.taxonomy?.accountSingular || ""}
                        onChange={(e) =>
                          setBizForm({
                            ...bizForm,
                            taxonomy: { ...bizForm.taxonomy, accountSingular: e.target.value },
                          })
                        }
                        placeholder="Ej. Mesa, Comanda, Carrito, Habitación"
                        className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-bold outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                        Término para Catálogo / Stock (Plural):
                      </label>
                      <input
                        type="text"
                        value={bizForm.taxonomy?.productsLabel || ""}
                        onChange={(e) =>
                          setBizForm({
                            ...bizForm,
                            taxonomy: { ...bizForm.taxonomy, productsLabel: e.target.value },
                          })
                        }
                        placeholder="Ej. Platos & Bebidas, Artículos, Servicios"
                        className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-bold outline-none text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                        Término para Producto Individual (Singular):
                      </label>
                      <input
                        type="text"
                        value={bizForm.taxonomy?.productSingular || ""}
                        onChange={(e) =>
                          setBizForm({
                            ...bizForm,
                            taxonomy: { ...bizForm.taxonomy, productSingular: e.target.value },
                          })
                        }
                        placeholder="Ej. Plato, Artículo, Servicio, Ítem"
                        className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-bold outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                        Texto del Botón de Cobro / Finalizar:
                      </label>
                      <input
                        type="text"
                        value={bizForm.taxonomy?.checkoutActionLabel || ""}
                        onChange={(e) =>
                          setBizForm({
                            ...bizForm,
                            taxonomy: { ...bizForm.taxonomy, checkoutActionLabel: e.target.value },
                          })
                        }
                        placeholder="Ej. Cobrar Comanda, Facturar, Liquidar Venta"
                        className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-bold outline-none text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                        Nombre del Documento de Venta:
                      </label>
                      <input
                        type="text"
                        value={bizForm.taxonomy?.ticketDocumentLabel || ""}
                        onChange={(e) =>
                          setBizForm({
                            ...bizForm,
                            taxonomy: { ...bizForm.taxonomy, ticketDocumentLabel: e.target.value },
                          })
                        }
                        placeholder="Ej. Ticket de Venta, Factura, Comprobante"
                        className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-bold outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                        Rol del Dependiente / Atendido por:
                      </label>
                      <input
                        type="text"
                        value={bizForm.taxonomy?.cashierRoleLabel || ""}
                        onChange={(e) =>
                          setBizForm({
                            ...bizForm,
                            taxonomy: { ...bizForm.taxonomy, cashierRoleLabel: e.target.value },
                          })
                        }
                        placeholder="Ej. Camarero, Dependiente, Mesero, Cajero"
                        className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-bold outline-none text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                        Nombre de la Sección de Almacén:
                      </label>
                      <input
                        type="text"
                        value={bizForm.taxonomy?.inventorySectionLabel || ""}
                        onChange={(e) =>
                          setBizForm({
                            ...bizForm,
                            taxonomy: { ...bizForm.taxonomy, inventorySectionLabel: e.target.value },
                          })
                        }
                        placeholder="Ej. Despensa & Stock, Almacén, Inventario"
                        className="w-full neu-inset rounded-xl px-3 h-9 text-xs font-bold outline-none text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TICKET TÉRMICO & POLÍTICAS */}
            {activeTab === "ticket" && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                    Mensaje de Agradecimiento al Pie del Ticket
                  </label>
                  <input
                    type="text"
                    value={bizForm.footerMessage}
                    onChange={(e) => setBizForm({ ...bizForm, footerMessage: e.target.value })}
                    placeholder="Ej. ¡Gracias por su visita! Vuelva pronto"
                    className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                    Política de Devoluciones / Garantía / Términos
                  </label>
                  <textarea
                    value={bizForm.returnPolicy || ""}
                    onChange={(e) => setBizForm({ ...bizForm, returnPolicy: e.target.value })}
                    placeholder="Ej. Para cambios o reclamos es indispensable presentar este ticket en un plazo de 7 días. No se aceptan devoluciones en productos abiertos."
                    rows={3}
                    className="w-full neu-inset rounded-xl p-3 text-xs font-medium outline-none text-slate-900 resize-none"
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
                  <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <IconPrinter size={15} />
                    <span>Compatibilidad de Impresión Térmica ESC/POS:</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Los encabezados, políticas y pies de página se imprimen de forma automática en impresoras Bluetooth, Wi-Fi de red, USB OTG y en formato PDF.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 4: IMPUESTOS & TASAS DE SERVICIO */}
            {activeTab === "taxes" && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Impuesto por Defecto (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={bizForm.defaultTaxRate !== undefined ? bizForm.defaultTaxRate : ""}
                      onChange={(e) =>
                        setBizForm({
                          ...bizForm,
                          defaultTaxRate: e.target.value ? parseFloat(e.target.value) : 0,
                        })
                      }
                      placeholder="0 (Opcional)"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Etiqueta del Impuesto
                    </label>
                    <input
                      type="text"
                      value={bizForm.taxLabel || ""}
                      onChange={(e) => setBizForm({ ...bizForm, taxLabel: e.target.value })}
                      placeholder="Ej. IVA, Tax, IGV, Impuesto"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Propina / Cargo por Servicio (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={bizForm.defaultTipRate !== undefined ? bizForm.defaultTipRate : ""}
                      onChange={(e) =>
                        setBizForm({
                          ...bizForm,
                          defaultTipRate: e.target.value ? parseFloat(e.target.value) : 0,
                        })
                      }
                      placeholder="0 (Opcional)"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Etiqueta de la Propina
                    </label>
                    <input
                      type="text"
                      value={bizForm.tipLabel || ""}
                      onChange={(e) => setBizForm({ ...bizForm, tipLabel: e.target.value })}
                      placeholder="Ej. Propina, Servicio, Tip"
                      className="w-full neu-inset rounded-xl px-3.5 h-10 text-xs font-bold outline-none text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: VISTA PREVIA DEL TICKET TÉRMICO */}
            {activeTab === "preview" && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-extrabold text-slate-800">
                    Simulador en Vivo de Ticket Térmico:
                  </div>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPaperWidth("58mm")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        paperWidth === "58mm" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600"
                      }`}
                    >
                      58 mm (32 col)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperWidth("80mm")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        paperWidth === "80mm" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600"
                      }`}
                    >
                      80 mm (48 col)
                    </button>
                  </div>
                </div>

                {/* Thermal Receipt Paper Card */}
                <div className="bg-amber-50/40 p-4 rounded-3xl border border-amber-200/80 shadow-inner flex justify-center">
                  <div
                    className={`bg-white rounded-2xl p-4 shadow-xl border border-slate-200 font-mono text-[11.5px] leading-tight text-slate-900 whitespace-pre ${
                      paperWidth === "80mm" ? "w-full max-w-[360px]" : "w-full max-w-[280px]"
                    }`}
                  >
                    {livePreviewText}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="text-xs font-extrabold text-slate-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition"
            >
              <IconRefreshCw size={13} />
              <span>Restablecer valores de fábrica</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl neu-sm text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-200 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSaveAndApply}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95"
              >
                <IconCheck size={16} />
                <span>Guardar y Aplicar Cambios</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

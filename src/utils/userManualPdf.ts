import jsPDF from "jspdf";
import { deliverPdfFile } from "./pdfExport";

/**
 * Generates an exhaustive, high-fidelity, multi-page User Manual PDF for CajaMaster POS.
 * Includes visual vector UI representations (mockups), detailed step-by-step instructions,
 * formulas, calculations (including 10.000 and 20.000 CUP bills), troubleshooting, and button glossary.
 */
export async function generateUserManualPdf(businessName = "CajaMaster POS", preferShare = false): Promise<boolean> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  let y = margin;

  // Colors Palette
  const C_DARK_BG = [15, 23, 42]; // slate-900 #0f172a
  const C_DARK_CARD = [30, 41, 59]; // slate-800 #1e293b
  const C_AMBER = [245, 158, 11]; // amber-500 #f59e0b
  const C_AMBER_LIGHT = [254, 243, 199]; // amber-100 #fef3c7
  const C_EMERALD = [16, 185, 129]; // emerald-500 #10b981
  const C_EMERALD_BG = [236, 253, 245]; // emerald-50
  const C_BLUE = [37, 99, 235]; // blue-600 #2563eb
  const C_BLUE_BG = [239, 246, 255]; // blue-50
  const C_PURPLE = [147, 51, 234]; // purple-600 #9333ea
  const C_PURPLE_BG = [250, 245, 255]; // purple-50
  const C_TEXT_MAIN = [15, 23, 42]; // slate-900
  const C_TEXT_MUTED = [71, 85, 105]; // slate-600
  const C_TEXT_LIGHT = [148, 163, 184]; // slate-400
  const C_BORDER = [226, 232, 240]; // slate-200
  const C_CARD_BG = [248, 250, 252]; // slate-50

  const addHeader = (chapterTitle: string) => {
    doc.setFillColor(C_DARK_BG[0], C_DARK_BG[1], C_DARK_BG[2]);
    doc.rect(0, 0, pageWidth, 9, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(251, 191, 36); // amber-400
    doc.text("CAJAMASTER POS", margin, 6);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225);
    doc.text(` |  ${chapterTitle.toUpperCase()}`, margin + doc.getTextWidth("CAJAMASTER POS") + 1, 6);

    doc.setTextColor(148, 163, 184);
    doc.text("GUIA OFICIAL DE OPERACION  •  100% OFFLINE", pageWidth - margin, 6, { align: "right" });
    doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
  };

  const addFooter = (currentPage: number, totalPages = 7) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(C_TEXT_LIGHT[0], C_TEXT_LIGHT[1], C_TEXT_LIGHT[2]);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    doc.text(`CajaMaster POS  •  Manual de Usuario  •  ${businessName}`, margin, pageHeight - 6.5);
    doc.text(`Pagina ${currentPage} de ${totalPages}`, pageWidth - margin, pageHeight - 6.5, { align: "right" });
  };

  const checkPageBreak = (neededHeight: number, chapterTitle: string) => {
    if (y + neededHeight > pageHeight - margin - 12) {
      const pageNum = (doc as any).internal.getNumberOfPages();
      addFooter(pageNum);
      doc.addPage();
      y = margin + 4;
      addHeader(chapterTitle);
    }
  };

  const renderSectionHeader = (number: string, title: string, badge: string, badgeColor = C_AMBER) => {
    checkPageBreak(16, title);
    doc.setFillColor(C_DARK_BG[0], C_DARK_BG[1], C_DARK_BG[2]);
    doc.roundedRect(margin, y, contentWidth, 8.5, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`${number}. ${title.toUpperCase()}`, margin + 4, y + 5.8);

    // Badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const badgeWidth = doc.getTextWidth(badge) + 6;
    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.roundedRect(pageWidth - margin - badgeWidth - 3, y + 1.8, badgeWidth, 5, 1.5, 1.5, "F");
    doc.setTextColor(C_DARK_BG[0], C_DARK_BG[1], C_DARK_BG[2]);
    doc.text(badge, pageWidth - margin - 3 - badgeWidth / 2, y + 5.2, { align: "center" });

    y += 12;
  };

  const renderCardBox = (title: string, contentLines: string[], iconTag = "[INFO]", bgColor = C_CARD_BG, borderColor = C_BORDER) => {
    const innerPaddingX = 6;
    const maxTextWidth = contentWidth - (innerPaddingX * 2);
    const lineHeight = 4.2;
    const titleHeight = title ? 6.5 : 0;
    
    // CRITICAL: Set font properties BEFORE splitting text to guarantee accurate character width calculations
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);

    // Calculate wrapped text lines with exact font metrics
    const processedLines: string[] = [];
    contentLines.forEach((rawLine) => {
      const cleanLine = rawLine.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
      const wrapped = doc.splitTextToSize(cleanLine, maxTextWidth);
      if (Array.isArray(wrapped)) {
        wrapped.forEach((w: string) => processedLines.push(w));
      } else {
        processedLines.push(wrapped);
      }
    });

    const totalHeight = titleHeight + (processedLines.length * lineHeight) + 6;
    checkPageBreak(totalHeight + 3, title || "INFORMACION");

    // Clean container box (no misaligned outer drop-shadows)
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, contentWidth, totalHeight, 2.5, 2.5, "FD");

    let currentY = y + 5;
    if (title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
      doc.text(`${iconTag}  ${title}`, margin + innerPaddingX, currentY);
      currentY += 5.5;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(C_TEXT_MUTED[0], C_TEXT_MUTED[1], C_TEXT_MUTED[2]);
    processedLines.forEach((line) => {
      doc.text(line, margin + innerPaddingX, currentY);
      currentY += lineHeight;
    });

    y += totalHeight + 3.5;
  };

  const renderStep = (num: string, stepTitle: string, stepDesc: string) => {
    // CRITICAL: Set font before splitTextToSize
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    const maxDescWidth = contentWidth - 16;
    const wrappedDesc: string[] = doc.splitTextToSize(stepDesc, maxDescWidth);
    const stepHeight = Math.max(9, wrappedDesc.length * 4.0 + 5.5);
    checkPageBreak(stepHeight + 2, stepTitle);

    // Number square badge
    doc.setFillColor(C_DARK_BG[0], C_DARK_BG[1], C_DARK_BG[2]);
    doc.roundedRect(margin, y, 7, 7, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(251, 191, 36);
    doc.text(num, margin + 3.5, y + 4.8, { align: "center" });

    // Step Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
    doc.text(stepTitle, margin + 10, y + 4.5);

    // Description text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(C_TEXT_MUTED[0], C_TEXT_MUTED[1], C_TEXT_MUTED[2]);
    let dy = y + 8.8;
    wrappedDesc.forEach((line: string) => {
      doc.text(line, margin + 10, dy);
      dy += 3.9;
    });

    y += stepHeight + 3;
  };

  // =========================================================================
  // PAGINA 1: PORTADA EJECUTIVA, RESUMEN & TABLA DE CONTENIDO
  // =========================================================================
  
  // Header Banner Portada
  doc.setFillColor(C_DARK_BG[0], C_DARK_BG[1], C_DARK_BG[2]);
  doc.rect(0, 0, pageWidth, 58, "F");

  // Gold Accent line
  doc.setFillColor(C_AMBER[0], C_AMBER[1], C_AMBER[2]);
  doc.rect(0, 58, pageWidth, 3.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("CAJAMASTER POS", margin, 22);

  doc.setFontSize(12);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text("Manual de Usuario, Guia de Operacion y Documentacion Oficial", margin, 31);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Negocio / Terminal: ${businessName}   |   Edicion Comercial 2026`, margin, 40);
  doc.text("Sistema Integral de Punto de Venta Offline, Arqueo Z con Billetes 10k/20k, IPVE e Inteligencia Artificial", margin, 46);

  // Status Badges on Cover
  const coverBadges = [
    { label: "100% OFFLINE FIRST", bg: [16, 185, 129] },
    { label: "BILLETES 10.000 Y 20.000 CUP", bg: [245, 158, 11] },
    { label: "IMPRESION ESC/POS", bg: [37, 99, 235] },
    { label: "IA GEMINI OPCIONAL", bg: [147, 51, 234] },
  ];
  let badgeX = margin;
  coverBadges.forEach((b) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    const w = doc.getTextWidth(b.label) + 6;
    doc.setFillColor(b.bg[0], b.bg[1], b.bg[2]);
    doc.roundedRect(badgeX, 50, w, 4.5, 1.2, 1.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(b.label, badgeX + w / 2, 53.2, { align: "center" });
    badgeX += w + 2.5;
  });

  y = 69;

  // Box: Resumen del Sistema (Properly styled and wrapped inside container)
  renderCardBox(
    "PROPOSITO Y ARQUITECTURA DEL SISTEMA",
    [
      "CajaMaster POS es una aplicacion profesional de punto de venta (TPV), control de inventario y auditoria de caja especialmente disenada para operar sin conexion a Internet en comercios, restaurantes, bares, panaderias, tiendas de ropa y almacenes.",
      "Todas las transacciones, existencias y cierres se guardan en el almacenamiento seguro local del dispositivo. Cuenta ademas con sincronizacion Wi-Fi en red local entre varios telefonos, conexion directa a impresoras termicas Bluetooth/USB/Wi-Fi y un motor opcional de Inteligencia Artificial alimentado por la clave Gemini propia del usuario con costo cero."
    ],
    "[OBJETIVO]",
    [248, 250, 252],
    [203, 213, 225]
  );

  // Tabla de Contenido
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
  doc.text("TABLA DE CONTENIDOS Y MODULOS DEL MANUAL", margin, y + 2);
  y += 6;

  const tocItems = [
    { page: "Pag. 2", title: "Modulo de Caja & TPV (Ventas, Billetes de 10k/20k, Divisas y Tickets)", tag: "Operacion Diaria" },
    { page: "Pag. 3", title: "Modulo de Inventario, Codigos de Barra, Fotos y Asistente con IA", tag: "Almacen & Stock" },
    { page: "Pag. 4", title: "Modulo de Cierre de Caja & Arqueo Z (Desglose de Billetes y Auditoria)", tag: "Control & Efectivo" },
    { page: "Pag. 5", title: "Modulo de Reportes IPV / IPVE, Conciliacion y Analitica Inteligente", tag: "Contabilidad" },
    { page: "Pag. 6", title: "Ajustes, Impresoras Termicas ESC/POS, Red Local Wi-Fi y Modo Oscuro", tag: "Configuracion" },
    { page: "Pag. 7", title: "Glosario Integral de Botones, Iconos, Solucion de Problemas (FAQ) y Atajos", tag: "Soporte" },
  ];

  tocItems.forEach((item, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
    doc.roundedRect(margin, y, contentWidth, 7.5, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(C_AMBER[0], C_AMBER[1], C_AMBER[2]);
    doc.text(item.page, margin + 3, y + 4.8);

    doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
    doc.text(item.title, margin + 18, y + 4.8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(C_TEXT_LIGHT[0], C_TEXT_LIGHT[1], C_TEXT_LIGHT[2]);
    doc.text(item.tag, pageWidth - margin - 3, y + 4.8, { align: "right" });

    y += 9;
  });

  // Requisitos y Licencia Offline
  y += 2;
  renderCardBox(
    "GARANTIA DE AUTONOMIA OFFLINE Y SEGURIDAD",
    [
      "• Autonomia Total: No requiere conexion a internet para cobrar, emitir tickets, calcular arqueos ni consultar el IPVE.",
      "• Persistencia Criptografica: La licencia offline permanece ligada al ID de hardware de su terminal de forma inalterable.",
      "• Cero Claves Hardcodeadas: Su privacidad comercial es absoluta; las copias de seguridad residen unicamente en su poder."
    ],
    "[SEGURIDAD]",
    [236, 253, 245],
    [167, 243, 208]
  );

  addFooter(1);

  // =========================================================================
  // PAGINA 2: MODULO DE CAJA & TPV (VENTAS, BILLETES Y COBROS)
  // =========================================================================
  doc.addPage();
  y = margin + 4;
  addHeader("Modulo 1: Caja & TPV");

  renderSectionHeader("1", "Modulo de Caja & Punto de Venta (TPV)", "Operacion Diaria", C_AMBER);

  // MOCKUP VECTORIAL DE LA PANTALLA DE CAJA
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 42, 3, 3, "FD");

  // Barra de Mockup Header
  doc.setFillColor(C_DARK_BG[0], C_DARK_BG[1], C_DARK_BG[2]);
  doc.roundedRect(margin + 2, y + 2, contentWidth - 4, 7, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("[VISTA INTERFAZ] CAJA TPV  •  BUSCADOR Y CATEGORIAS", margin + 5, y + 6.5);
  doc.setTextColor(251, 191, 36);
  doc.text("TOTAL: 2.850,00 CUP", pageWidth - margin - 6, y + 6.5, { align: "right" });

  // Grid de Productos simulada
  const pCols = [
    { name: "Cerveza Cristal", price: "280 CUP", stock: "Stk: 48", color: [219, 234, 254] },
    { name: "Refresco Lata", price: "190 CUP", stock: "Stk: 12", color: [254, 243, 199] },
    { name: "Sandwich Jamon", price: "450 CUP", stock: "Stk: 24", color: [220, 252, 231] },
    { name: "Cafe Espresso", price: "120 CUP", stock: "Stk: 80", color: [243, 232, 255] },
  ];
  let px = margin + 3;
  pCols.forEach((p) => {
    doc.setFillColor(p.color[0], p.color[1], p.color[2]);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(px, y + 11, 42, 13, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(p.name, px + 2, y + 15);
    doc.setFontSize(6);
    doc.setTextColor(C_BLUE[0], C_BLUE[1], C_BLUE[2]);
    doc.text(p.price, px + 2, y + 19.5);
    doc.setTextColor(C_TEXT_MUTED[0], C_TEXT_MUTED[1], C_TEXT_MUTED[2]);
    doc.text(p.stock, px + 40, y + 19.5, { align: "right" });
    px += 44.5;
  });

  // Botones Rápidos de Billetes en Mockup (destacando 10k y 20k)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
  doc.text("BOTONES DE BILLETES RAPIDOS:", margin + 4, y + 28);

  const mockBills = [
    { label: "+$500", bg: [241, 245, 249] },
    { label: "+$1.000", bg: [241, 245, 249] },
    { label: "+$5.000", bg: [241, 245, 249] },
    { label: "+$10.000 (NUEVO)", bg: [254, 243, 199] },
    { label: "+$20.000 (NUEVO)", bg: [254, 215, 170] },
  ];
  let bx = margin + 45;
  mockBills.forEach((mb) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    const bw = doc.getTextWidth(mb.label) + 4;
    doc.setFillColor(mb.bg[0], mb.bg[1], mb.bg[2]);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(bx, y + 25, bw, 5, 1, 1, "FD");
    doc.setTextColor(15, 23, 42);
    doc.text(mb.label, bx + bw / 2, y + 28.5, { align: "center" });
    bx += bw + 2;
  });

  // Boton Cobrar
  doc.setFillColor(C_EMERALD[0], C_EMERALD[1], C_EMERALD[2]);
  doc.roundedRect(margin + 3, y + 32, contentWidth - 6, 7.5, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("COBRAR VENTA  •  EFECTIVO / TRANSFERENCIA / DIVISAS (USD, EUR, MLC)", margin + contentWidth / 2, y + 36.8, { align: "center" });

  y += 46;

  // Pasos para realizar una venta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
  doc.text("PROCEDIMIENTO PASO A PASO PARA COBRAR UNA VENTA:", margin, y);
  y += 4;

  renderStep("1", "Seleccionar Articulos del Catalogo", "Toque las tarjetas de los productos o utilice la barra de busqueda superior o el filtro de categorias para agregar articulos al carrito.");
  renderStep("2", "Ajustar Cantidades y Descuentos", "En la vista del carrito, use los botones '+' y '-' para modificar unidades. Puede presionar el boton de descuento (%) para aplicar una rebaja fija o porcentual sobre el total.");
  renderStep("3", "Elegir Moneda de Cobro (CUP, USD, EUR, MLC)", "El sistema opera por defecto en Pesos Cubanos (CUP). Si el cliente paga en dolares o euros, seleccione la pestana de divisa; la app calculara el cambio exacto en CUP automaticamente segun la tasa configurada.");
  renderStep("4", "Uso de Billetes Rapidos (Nuevos Billetes de 10k y 20k)", "Pulse directamente los botones dorados de '+$10.000' y '+$20.000' para registrar el dinero entregado por el cliente sin necesidad de teclear cifras largas.");
  renderStep("5", "Finalizar e Imprimir / Compartir Ticket", "Presione 'Confirmar Cobro'. Podra imprimir inmediatamente el ticket en su impresora termica Bluetooth/Wi-Fi de 58mm u 80mm, abrir el dialogo del sistema o enviar el recibo por WhatsApp.");

  renderCardBox(
    "CONSEJO DE VELOCIDAD PARA EL CAJERO",
    [
      "• Modo Codigo de Barras: Conecte un lector de codigos USB OTG o Bluetooth para pistolerear articulos continuamente sin tocar la pantalla.",
      "• Venta a Credito / Deuda: Si tiene clientes fijos, puede marcar la venta como 'Pendiente' para cobrarla posteriormente en el modulo de entregas."
    ],
    "[TIP]",
    [254, 243, 199],
    [245, 158, 11]
  );

  addFooter(2);

  // =========================================================================
  // PAGINA 3: INVENTARIO, PRODUCTOS & ASISTENTE CON IA
  // =========================================================================
  doc.addPage();
  y = margin + 4;
  addHeader("Modulo 2: Inventario & IA");

  renderSectionHeader("2", "Modulo de Inventario, Catalogo y Asistente con IA", "Almacen & Stock", C_BLUE);

  // MOCKUP VECTORIAL DE EDICION DE PRODUCTO
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 38, 3, 3, "FD");

  // Mockup Form Header
  doc.setFillColor(C_BLUE[0], C_BLUE[1], C_BLUE[2]);
  doc.roundedRect(margin + 2, y + 2, contentWidth - 4, 6.5, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("[FORMULARIO] ALTA Y EDICION DE ARTICULOS  •  CONTROL DE COSTO Y MARGEN", margin + 5, y + 6.2);

  // Form Fields Mock
  const fields = [
    { label: "Nombre:", val: "Aceite Girasol 1L", w: 50 },
    { label: "Categoria:", val: "Comestibles", w: 35 },
    { label: "Costo Compra:", val: "650.00 CUP", w: 32 },
    { label: "Precio Venta:", val: "900.00 CUP", w: 32 },
  ];
  let fx = margin + 4;
  fields.forEach((f) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(fx, y + 11, f.w, 11, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(C_TEXT_MUTED[0], C_TEXT_MUTED[1], C_TEXT_MUTED[2]);
    doc.text(f.label, fx + 2, y + 14.5);
    doc.setFontSize(6.5);
    doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
    doc.text(f.val, fx + 2, y + 19.5);
    fx += f.w + 4;
  });

  // IA Button Mockup
  doc.setFillColor(C_PURPLE[0], C_PURPLE[1], C_PURPLE[2]);
  doc.roundedRect(margin + 4, y + 24, 75, 7.5, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text("SUGERIR CON IA (GOOGLE GEMINI)", margin + 7, y + 29);

  // Margin calculation indicator
  doc.setFillColor(C_EMERALD_BG[0], C_EMERALD_BG[1], C_EMERALD_BG[2]);
  doc.setDrawColor(C_EMERALD[0], C_EMERALD[1], C_EMERALD[2]);
  doc.roundedRect(margin + 83, y + 24, contentWidth - 87, 7.5, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(C_EMERALD[0], C_EMERALD[1], C_EMERALD[2]);
  doc.text("MARGEN CALCULADO: +38.46% (Ganancia: +250.00 CUP/u)", margin + 86, y + 29);

  y += 42;

  // Instrucciones del Módulo de Inventario
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
  doc.text("GESTION DETALLADA DE PRODUCTOS Y STOCK:", margin, y);
  y += 4;

  renderStep("1", "Creacion y Costeo de Productos", "Ingrese el nombre del articulo, el costo real de adquisicion y el precio de venta final al publico. La aplicacion calcula en tiempo real el porcentaje de margen de utilidad.");
  renderStep("2", "Asistente Inteligente con IA ('Sugerir con IA')", "Al escribir el nombre de un articulo nuevo, presione el boton violeta 'Sugerir con IA'. El modelo Gemini analizara el producto y autocompletara la categoria optima, emoji representativo y precio sugerido.");
  renderStep("3", "Codigos de Barra y Fotografias", "Toque el boton de camara para tomar una foto del articulo o escanear el codigo de barras EAN-13/UPC con la camara del telefono. Tambien puede asociar imagenes de la galeria.");
  renderStep("4", "Alertas de Stock Minimo", "Defina el umbral minimo de existencias (ej. 5 unidades). Cuando las ventas reduzcan el stock a ese numero o menos, el sistema emitira alertas sonoras, vibracion y avisos visuales en color rojo.");

  renderCardBox(
    "CONFIGURACION DE LA CLAVE IA DE GEMINI (GRATIS Y PRIVADA)",
    [
      "1. Vaya a la pantalla de Ajustes -> 'Configuracion de Inteligencia Artificial'.",
      "2. Obtenga su clave API gratuita en Google AI Studio (aistudio.google.com/apikey).",
      "3. Peguela en el campo correspondiente y presione 'Probar y Guardar Clave'.",
      "• Privacidad: La clave se almacena exclusivamente en su telefono y nunca se comparte con terceros."
    ],
    "[GUIA IA]",
    [250, 245, 255],
    [216, 180, 254]
  );

  addFooter(3);

  // =========================================================================
  // PAGINA 4: CIERRE DE CAJA & ARQUEO Z (CONTEO DE BILLETES)
  // =========================================================================
  doc.addPage();
  y = margin + 4;
  addHeader("Modulo 3: Cierre Z & Arqueo");

  renderSectionHeader("3", "Modulo de Cierre de Caja & Arqueo Z", "Auditoria & Efectivo", C_PURPLE);

  // MOCKUP VECTORIAL DE LA CALCULADORA DE BILLETES CUBANOS
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 44, 3, 3, "FD");

  // Mockup Header
  doc.setFillColor(C_PURPLE[0], C_PURPLE[1], C_PURPLE[2]);
  doc.roundedRect(margin + 2, y + 2, contentWidth - 4, 6.5, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("[ARQUEO FISICO] CALCULADORA Y DESGLOSE DE BILLETES (CUP)", margin + 5, y + 6.2);
  doc.setTextColor(251, 191, 36);
  doc.text("INCLUYE NUEVAS DENOMINACIONES 10K Y 20K", pageWidth - margin - 6, y + 6.2, { align: "right" });

  // Denominaciones representativas
  const denoms = [
    { label: "20.000 CUP", qty: "4 piezas", sub: "= 80.000 CUP", tag: "NUEVO", color: [254, 215, 170] },
    { label: "10.000 CUP", qty: "6 piezas", sub: "= 60.000 CUP", tag: "NUEVO", color: [254, 243, 199] },
    { label: "5.000 CUP", qty: "10 piezas", sub: "= 50.000 CUP", tag: "BILLETE", color: [241, 245, 249] },
    { label: "1.000 CUP", qty: "25 piezas", sub: "= 25.000 CUP", tag: "BILLETE", color: [241, 245, 249] },
  ];
  let dx = margin + 3;
  denoms.forEach((d) => {
    doc.setFillColor(d.color[0], d.color[1], d.color[2]);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(dx, y + 10.5, 42, 14, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(d.label, dx + 2, y + 14.5);
    doc.setFontSize(5.5);
    doc.setTextColor(C_TEXT_MUTED[0], C_TEXT_MUTED[1], C_TEXT_MUTED[2]);
    doc.text(`Cantidad: ${d.qty}`, dx + 2, y + 18.5);
    doc.setFontSize(6.5);
    doc.setTextColor(C_EMERALD[0], C_EMERALD[1], C_EMERALD[2]);
    doc.text(d.sub, dx + 2, y + 22.5);
    dx += 44.5;
  });

  // Resumen del Arqueo en Mockup
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin + 3, y + 27, contentWidth - 6, 13, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text("Efectivo Esperado (Teorico): 215.000,00 CUP", margin + 6, y + 32);
  doc.text("Efectivo Contado (Fisico): 215.000,00 CUP", margin + 6, y + 37);

  doc.setFillColor(C_EMERALD_BG[0], C_EMERALD_BG[1], C_EMERALD_BG[2]);
  doc.roundedRect(margin + 110, y + 29, 65, 9, 1.5, 1.5, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(C_EMERALD[0], C_EMERALD[1], C_EMERALD[2]);
  doc.text("DESCUADRE: 0.00 CUP (CAJA CUADRADA)", margin + 142.5, y + 35, { align: "center" });

  y += 48;

  // Procedimiento de Auditoría
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
  doc.text("PASOS PARA REALIZAR EL CIERRE DE CAJA OFICIAL (TICKET Z):", margin, y);
  y += 4;

  renderStep("1", "Abrir la Calculadora de Billetes", "En la pantalla 'Cierre', presione 'Desglose Billetes (Nuevos 10k y 20k)'. El sistema desplegara las denominaciones completas de Cuba (desde 1 CUP hasta 20.000 CUP).");
  renderStep("2", "Contar Fisicamente las Piezas de Dinero", "Introduzca la cantidad exacta de billetes de cada valor que tiene en el cajon de dinero. La aplicacion sumara el subtotal por denominacion y el gran total fisico.");
  renderStep("3", "Aplicar y Verificar el Descuadre de Caja", "Presione 'Aplicar al Efectivo Contado'. La aplicacion ejecutara la formula oficial: [Descuadre] = [Efectivo Fisico Contado] - [Efectivo Esperado]. Si el resultado es 0.00, la caja esta perfectamente cuadrada.");
  renderStep("4", "Balance de Inventario Fisico al Cierre", "El sistema muestra las unidades fisicas restantes y el valor total del almacen tanto a costo como a precio de venta.");
  renderStep("5", "Guardar e Imprimir / Compartir Reporte Z", "Presione 'REGISTRAR CIERRE Z Y BLOQUEAR TURNO'. Podra imprimir el ticket Z termico o enviar el resumen auditado por WhatsApp.");

  renderCardBox(
    "FORMULA OFICIAL DE DESCUADRE DE AUDITORIA",
    [
      "• [Descuadre / Diferencia] = [Efectivo Contado (Fisico)] - [Efectivo Esperado (Teorico)]",
      "• Valor Positivo (+): Sobrante de dinero en caja.",
      "• Valor Cero (0.00): Caja exactamente cuadrada con el registro de ventas.",
      "• Valor Negativo (-): Faltante de dinero en caja que requiere justificacion del cajero."
    ],
    "[FORMULA]",
    [248, 250, 252],
    [203, 213, 225]
  );

  addFooter(4);

  // =========================================================================
  // PAGINA 5: REPORTES IPV / IPVE & CONCILIACION CONTABLE
  // =========================================================================
  doc.addPage();
  y = margin + 4;
  addHeader("Modulo 4: Reportes IPVE & IA");

  renderSectionHeader("4", "Modulo de Reportes IPV / IPVE & Analitica", "Contabilidad", C_EMERALD);

  // MOCKUP VECTORIAL DE TABLA IPVE
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 38, 3, 3, "FD");

  // Mockup Table Header
  doc.setFillColor(C_EMERALD[0], C_EMERALD[1], C_EMERALD[2]);
  doc.roundedRect(margin + 2, y + 2, contentWidth - 4, 6.5, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("[INFORME IPVE] BALANCE DE MERCANCIA: INICIAL + ENTRADAS - FINAL = VENDIDO", margin + 5, y + 6.2);

  // Table rows mock
  const ipveRows = [
    { p: "Cerveza Cristal", ini: "20 u", ent: "+40 u", fin: "12 u", ven: "48 u", imp: "13.440 CUP" },
    { p: "Refresco Lata", ini: "10 u", ent: "+20 u", fin: "18 u", ven: "12 u", imp: "2.280 CUP" },
    { p: "Aceite Girasol", ini: "5 u", ent: "+15 u", fin: "6 u", ven: "14 u", imp: "12.600 CUP" },
  ];
  let ry = y + 10.5;
  ipveRows.forEach((r, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + 3, ry, contentWidth - 6, 6, 1, 1, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(15, 23, 42);
    doc.text(r.p, margin + 5, ry + 4.2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(C_TEXT_MUTED[0], C_TEXT_MUTED[1], C_TEXT_MUTED[2]);
    doc.text(`Ini: ${r.ini}  |  Ent: ${r.ent}  |  Fin: ${r.fin}`, margin + 55, ry + 4.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(C_EMERALD[0], C_EMERALD[1], C_EMERALD[2]);
    doc.text(`Vendido: ${r.ven}`, margin + 120, ry + 4.2);
    doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
    doc.text(r.imp, pageWidth - margin - 6, ry + 4.2, { align: "right" });
    ry += 7;
  });

  // Totales Summary Bar
  doc.setFillColor(C_DARK_BG[0], C_DARK_BG[1], C_DARK_BG[2]);
  doc.roundedRect(margin + 3, ry + 1, contentWidth - 6, 6.5, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(251, 191, 36);
  doc.text("TOTALES DEL PERIODO:", margin + 6, ry + 5.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Importe Vendido: 28.320,00 CUP  |  Costo: 18.200,00 CUP  |  Ganancia: +10.120,00 CUP", margin + 45, ry + 5.5);

  y += 42;

  // Explicación de Reportes IPV
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
  doc.text("CONCEPTOS Y AUDITORIA DEL INFORME IPVE:", margin, y);
  y += 4;

  renderStep("1", "Calculo del Consumo / Venta de Mercancia", "El informe IPVE aplica la ecuacion contable estandar: [Consumo / Venta] = [Existencia Inicial] + [Entradas / Compras] - [Existencia Final].");
  renderStep("2", "Conciliacion de Mercancia vs. Cierres Z", "El panel de conciliacion cruza las ventas teoricas del inventario con el dinero fisico efectivamente contado en los cierres de caja del periodo para detectar mermas o fugas.");
  renderStep("3", "Consultas en Lenguaje Natural con IA", "En la seccion 'Analista de Negocio con IA', puede preguntar: 'Cual fue el producto mas rentable?', 'A que hora vendemos mas?' o 'Que productos tienen bajo stock?' para recibir informes instantaneos.");
  renderStep("4", "Exportacion Oficial a PDF y CSV", "Descargue el documento PDF legal con membrete, lineas de firma de auditoria, desglose fiscal y formato tabular para control contable del negocio.");

  renderCardBox(
    "FIRMAS Y VALIDEZ LEGAL DEL INFORME",
    [
      "El PDF generado desde la pantalla de Reportes incluye tres casillas de validacion:",
      "1. Elaborado por (Cajero / Administrador)   2. Revisado por (Contabilidad)   3. Aprobado por (Titular del Negocio).",
      "Permite adjuntar notas personalizadas y observaciones para cumplir con auditorias comerciales."
    ],
    "[DOCUMENTO LEGAL]",
    [236, 253, 245],
    [167, 243, 208]
  );

  addFooter(5);

  // =========================================================================
  // PAGINA 6: AJUSTES, HARDWARE, RED LOCAL & MODO OSCURO
  // =========================================================================
  doc.addPage();
  y = margin + 4;
  addHeader("Modulo 5: Ajustes & Hardware");

  renderSectionHeader("5", "Ajustes, Impresoras, Red Local y Modo Oscuro", "Configuracion", C_DARK_CARD);

  // MOCKUP DE AJUSTES & HARDWARE
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 40, 3, 3, "FD");

  // Mockup Header
  doc.setFillColor(C_DARK_BG[0], C_DARK_BG[1], C_DARK_BG[2]);
  doc.roundedRect(margin + 2, y + 2, contentWidth - 4, 6.5, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("[PANEL DE CONTROL] CONFIGURACION DE DISPOSITIVOS Y PREFERENCIAS", margin + 5, y + 6.2);

  // Mockup cards
  const settingCards = [
    { title: "Impresoras Termicas", desc: "Bluetooth LE, Wi-Fi IP, USB OTG (ESC/POS)", icon: "[PRINTER]" },
    { title: "Red Multi-Terminal", desc: "Sincronizacion Wi-Fi local sin Internet", icon: "[WIFI]" },
    { title: "Modo Oscuro / Temas", desc: "Midnight OLED, Carbon, Claro y Ambar", icon: "[THEME]" },
    { title: "Copias JSON", desc: "Exportacion y restauracion de base de datos", icon: "[BACKUP]" },
  ];
  let scx = margin + 4;
  let scy = y + 10.5;
  settingCards.forEach((c, idx) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(scx, scy, 85, 12, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${c.icon} ${c.title}`, scx + 3, scy + 4.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(C_TEXT_MUTED[0], C_TEXT_MUTED[1], C_TEXT_MUTED[2]);
    doc.text(c.desc, scx + 3, scy + 8.5);

    if (idx === 1) {
      scx = margin + 4;
      scy += 14;
    } else {
      scx += 89;
    }
  });

  y += 44;

  // Funciones de Configuración
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
  doc.text("CONFIGURACION DE HARDWARE Y SERVICIOS:", margin, y);
  y += 4;

  renderStep("1", "Impresoras Termicas de Tickets (ESC/POS)", "Conecte impresoras termicas de 58mm u 80mm mediante Bluetooth inalambrico, cable USB OTG o por IP en red local Wi-Fi. Puede emitir un ticket de prueba para calibrar cortes y margenes.");
  renderStep("2", "Red Local Multi-Dispositivo (Wi-Fi)", "Permite conectar los telefonos de los camareros a la caja principal mediante la red Wi-Fi del negocio sin requerir conexion a Internet ni pagar servidores externos.");
  renderStep("3", "Seleccion de Tema Visual y Modo Oscuro", "Personalice la apariencia visual eligiendo entre 'Modo Oscuro OLED' (para ahorrar bateria y operar de noche) o 'Modo Claro de Alto Contraste' (para atencion bajo luz solar).");
  renderStep("4", "Tasas de Cambio de Divisas (USD, EUR, MLC)", "Actualice diariamente los valores de conversion respecto al Peso Cubano (CUP). Todas las operaciones de caja y redondeos se ajustaran automaticamente.");
  renderStep("5", "Copias de Seguridad en Archivo JSON", "Presione 'Exportar Base de Datos (JSON)' para descargar una copia integra de sus productos, ventas, historico y arqueos. Guardela en una memoria USB o tarjeta SD.");

  renderCardBox(
    "PROTOCOLO ANTE APAGONES O FALLAS DEL TELEFONO",
    [
      "• Realice una 'Exportacion JSON' al finalizar cada semana y enviesela por correo o guardela en una memoria USB.",
      "• Si cambia de telefono, instale CajaMaster POS, presione 'Restaurar Copia de Seguridad', elija el archivo JSON y recuperara el 100% de sus datos en 2 segundos."
    ],
    "[EMERGENCIA]",
    [254, 243, 199],
    [245, 158, 11]
  );

  addFooter(6);

  // =========================================================================
  // PAGINA 7: GLOSARIO DE BOTONES, FAQ & SOLUCION DE PROBLEMAS
  // =========================================================================
  doc.addPage();
  y = margin + 4;
  addHeader("Modulo 6: Glosario & FAQ");

  renderSectionHeader("6", "Glosario de Botones, Iconos y Solucion de Dudas", "Soporte Tecnico", C_AMBER);

  // Tabla de Iconos y Botones
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
  doc.text("SIGNIFICADO DE LOS BOTONES E ICONOS PRINCIPALES:", margin, y);
  y += 4.5;

  const glossaryItems = [
    { tag: "[ +$10k / +$20k ]", name: "Billetes Rapidos", desc: "Suma billetes de 10.000 o 20.000 CUP al efectivo recibido con un solo toque." },
    { tag: "[ SUGERIR IA ]", name: "Asistente Gemini", desc: "Autocompleta categorias, emojis y margenes recomendados con IA." },
    { tag: "[ ARQUEO Z ]", name: "Calculadora de Billetes", desc: "Despliega el conteo fisico por denominaciones desde 1 CUP hasta 20.000 CUP." },
    { tag: "[ IMPRESORA ]", name: "Impresion Termica", desc: "Envia tickets ESC/POS por Bluetooth, USB OTG o red Wi-Fi/IP." },
    { tag: "[ WHATSAPP ]", name: "Compartir Ticket", desc: "Genera el texto formateado del ticket o arqueo Z para enviarlo por WhatsApp." },
    { tag: "[ JSON ]", name: "Respaldo Total", desc: "Descarga o restaura la base de datos completa sin depender de servidores." },
  ];

  glossaryItems.forEach((item, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 7, 1.2, 1.2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(C_AMBER[0], C_AMBER[1], C_AMBER[2]);
    doc.text(item.tag, margin + 3, y + 4.5);

    doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
    doc.text(item.name, margin + 28, y + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(C_TEXT_MUTED[0], C_TEXT_MUTED[1], C_TEXT_MUTED[2]);
    doc.text(item.desc, margin + 65, y + 4.5);

    y += 8;
  });

  y += 2;

  // PREGUNTAS FRECUENTES (FAQ)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(C_TEXT_MAIN[0], C_TEXT_MAIN[1], C_TEXT_MAIN[2]);
  doc.text("PREGUNTAS FRECUENTES Y SOLUCION DE PROBLEMAS (FAQ):", margin, y);
  y += 4;

  const faqs = [
    {
      q: "1. Que hago si no tengo conexion a Internet en el local?",
      a: "No tiene que hacer nada. CajaMaster POS funciona al 100% de manera autonoma y local. Todas las ventas, inventarios y arqueos continuan funcionando normalmente sin datos moviles ni Wi-Fi con Internet."
    },
    {
      q: "2. Como conecto mi impresora termica Bluetooth?",
      a: "Encienda la impresora y el Bluetooth del telefono. Vaya a Ajustes -> Impresoras y presione 'Escanear Bluetooth'. Seleccione su modelo (ej. MPT-II, POS-58, POS-80) y pulse 'Imprimir Prueba'."
    },
    {
      q: "3. Que pasa si el dinero en caja no coincide con las ventas?",
      a: "En la pantalla de Cierre, la calculadora le indicara el 'Descuadre'. Si es negativo (-), verifique si hubo pagos no registrados en transferencias o gastos de caja sacados durante el turno."
    },
    {
      q: "4. Las funciones de Inteligencia Artificial tienen algun costo mensual?",
      a: "Cero costo. El sistema utiliza el plan gratuito de Google Gemini API donde cada comercio introduce su propia clave personal obtenida sin costo en Google AI Studio."
    }
  ];

  faqs.forEach((faq) => {
    // Set font before splitTextToSize
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    const qWrapped: string[] = doc.splitTextToSize(faq.q, contentWidth - 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    const aWrapped: string[] = doc.splitTextToSize(faq.a, contentWidth - 10);

    const faqHeight = (qWrapped.length * 3.7) + (aWrapped.length * 3.5) + 5.5;

    checkPageBreak(faqHeight + 2, "FAQ & Soporte");

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, faqHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(C_DARK_BG[0], C_DARK_BG[1], C_DARK_BG[2]);
    let fqY = y + 4.0;
    qWrapped.forEach((line: string) => {
      doc.text(line, margin + 4, fqY);
      fqY += 3.7;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(C_TEXT_MUTED[0], C_TEXT_MUTED[1], C_TEXT_MUTED[2]);
    aWrapped.forEach((line: string) => {
      doc.text(line, margin + 4, fqY);
      fqY += 3.5;
    });

    y += faqHeight + 2.5;
  });

  addFooter(7);

  // Deliver PDF file
  const filename = `Manual_Usuario_${businessName.replace(/\s+/g, "_")}_Guia_Completa.pdf`;
  return (await deliverPdfFile(doc, filename, "Manual de Usuario Oficial CajaMaster POS", preferShare)).success;
}

/**
 * Detailed user manual of CajaMaster POS (step by step, one chapter per function).
 *
 * Single source of truth: the same content is shown inside the app (Guía → «Manual completo»)
 * and exported as the detailed PDF (utils/detailedManualPdf.ts). When a feature changes,
 * update it here and both stay in sync.
 */

export interface ManualSection {
  title: string;
  /** Short paragraph before the steps. */
  intro?: string;
  /** Numbered steps, in order. */
  steps?: string[];
  /** Unordered list (options, fields, meanings). */
  bullets?: string[];
  /** Useful advice. */
  tips?: string[];
  /** Important warning. */
  warning?: string;
  /** Marked as «Nuevo». */
  isNew?: boolean;
  /** Screenshots of the app (files in public/manual/), shown after the text. */
  images?: ManualImage[];
}

export interface ManualImage {
  /** File name inside public/manual/ */
  file: string;
  caption: string;
}

/** URL of a manual screenshot (works on the web, in the APK and in OTA bundles). */
export function manualImageUrl(file: string): string {
  return `${import.meta.env.BASE_URL || "/"}manual/${file}`;
}

export interface ManualChapter {
  id: string;
  icon: string;
  title: string;
  summary: string;
  /** Marked as «Nuevo» (added in recent versions). */
  isNew?: boolean;
  sections: ManualSection[];
}

export const MANUAL_EDITION = "Edición 1.4 · noviembre 2026";

export const MANUAL_CHAPTERS: ManualChapter[] = [
  {
    id: "inicio",
    icon: "🚀",
    title: "Primeros pasos",
    summary: "Activar la licencia, configurar el negocio y dejar la app lista para vender.",
    sections: [
      {
        title: "Activar la licencia",
        images: [{ file: "activacion.jpg", caption: "Pantalla de activación: arriba el ID del dispositivo con los botones de WhatsApp y Telegram; abajo, «Pegar clave» y «ACTIVAR LICENCIA»." }],
        intro:
          "La primera vez que abres la app aparece la pantalla de activación. Cada licencia es única para un dispositivo: no se puede copiar a otro teléfono.",
        steps: [
          "Copia el «ID del dispositivo» que aparece en pantalla (formato CM-XXXX-XXXX-XXXX).",
          "Envíalo al vendedor con el botón «WhatsApp» o «Telegram»: el mensaje se escribe solo con tu ID.",
          "Cuando recibas la clave de activación (empieza por CM1-), pégala con el botón «Pegar clave» (es larga: mejor pegarla que escribirla).",
          "Toca «ACTIVAR LICENCIA». Si la clave es correcta, la app se abre y queda activada sin necesidad de internet.",
        ],
        tips: ["Puedes consultar el estado de la licencia en Ajustes → Licencia → «Consultar Estado»."],
        warning: "Una clave generada para otro dispositivo no funciona en el tuyo. Si cambias de teléfono, pide una licencia nueva.",
      },
      {
        title: "Datos del negocio",
        intro: "Estos datos aparecen en los tickets, en el cierre Z y en los informes.",
        steps: [
          "Ve a Ajustes → «Datos del Establecimiento» y toca «Personalizar».",
          "Escribe el nombre del negocio, propietario, identificación fiscal, teléfono y dirección.",
          "Opcional: encabezado del ticket, mensaje al pie, impuesto (%) y propina (%) predeterminados.",
          "Guarda los cambios.",
        ],
      },
      {
        title: "Plantilla de tu sector y categorías",
        steps: [
          "En Ajustes → «Plantillas Rápidas por Sector» elige Gastronomía, Comercio minorista, Servicios o «Limpio / En blanco».",
          "La plantilla crea categorías y parámetros de ejemplo; después puedes cambiarlas en Ajustes → «Categorías del Catálogo» → «Administrar».",
        ],
        warning: "Aplicar una plantilla reinicia el catálogo y los datos de la app. Úsala solo al empezar, o después de hacer una copia de seguridad.",
      },
      {
        title: "Formato de pantalla y aspecto",
        bullets: [
          "Formato de pantalla (Ajustes → Tema & Modo Visual): «Móvil», «Tablet / Mostrador» o escritorio. Elige el que mejor se vea en tu equipo.",
          "Modo oscuro y temas de color: en la misma sección.",
          "«Tamaño y márgenes» → «Tamaño de letra y botones»: agranda toda la app (letras, botones e iconos) de 90% a 140% con los botones Normal / Grande / Muy grande, A− / A+ o la barra. Cada formato (Móvil, Tablet, Escritorio) recuerda su propio tamaño.",
          "En la misma ventana: márgenes superior e inferior, por si la cámara del teléfono tapa los títulos o los botones del sistema tapan el botón de cobrar.",
        ],
      },
    ],
  },
  {
    id: "caja",
    icon: "🛒",
    title: "Caja: vender y cobrar",
    summary: "Añadir productos al ticket, cuentas y mesas, descuentos y todas las formas de cobro.",
    sections: [
      {
        title: "Añadir productos al ticket",
        images: [{ file: "caja.jpg", caption: "Pestaña CAJA: buscador, categorías y productos. El número amarillo indica cuántas unidades hay en el ticket; abajo a la derecha, el botón para cobrar." }],
        steps: [
          "Abre la pestaña «CAJA».",
          "Toca un producto para añadir una unidad. Cada toque suma otra.",
          "Para encontrar un producto usa el buscador de arriba o la barra de categorías.",
          "Cambia la vista del catálogo (tarjetas grandes, cuadrícula o lista) con los botones de la derecha.",
          "En el móvil, el botón flotante «COBRAR» muestra el total y abre el ticket.",
        ],
        tips: ["Los productos con poco stock muestran un aviso; si no queda stock no se pueden vender."],
      },
      {
        title: "Modificar el ticket",
        bullets: [
          "Botones + y −: cambian la cantidad de cada línea.",
          "Papelera: elimina la línea.",
          "«Vaciar»: borra todo el ticket actual.",
          "«+ Aplicar Descuento»: descuento en la moneda de cobro; se descuenta del total.",
        ],
      },
      {
        title: "Mesas y cuentas abiertas",
        intro: "Puedes tener varias cuentas abiertas a la vez (mesas, clientes que esperan, pedidos para llevar).",
        steps: [
          "Toca «Mesas / Cuentas» → «+» para crear una cuenta nueva y ponle un nombre (por ejemplo «Mesa 4»).",
          "Cambia entre cuentas tocando su nombre; cada una guarda sus productos.",
          "Para renombrar una cuenta, toca el lápiz ✏️.",
          "Al cobrar una cuenta, se cierra y desaparece de la lista.",
        ],
      },
      {
        title: "Elegir la moneda de cobro",
        intro:
          "Los precios se guardan en CUP. Con el selector de moneda de la barra superior (CUP ⇄) eliges en qué moneda cobras: CUP, USD, EUR o MLC. Todos los importes de la pantalla de cobro se muestran en esa moneda usando la tasa configurada.",
        tips: ["Las tasas se configuran en Ajustes → «Moneda & Tipos de Cambio» (ver capítulo «Monedas y tasas»)."],
      },
      {
        title: "Cobrar en efectivo",
        images: [{ file: "cobro.jpg", caption: "Cobro en efectivo: total a cobrar, método «Efectivo», efectivo recibido, billetes rápidos y el «CAMBIO A DEVOLVER»." }],
        steps: [
          "Toca «Cobrar» y elige «Efectivo».",
          "El campo «Efectivo recibido» empieza vacío: escribe lo que entrega el cliente o toca los billetes rápidos (se suman).",
          "«Exacto» rellena el importe justo del total.",
          "Si falta dinero aparece «FALTA POR COBRAR» y no se puede confirmar la venta.",
          "Si sobra, aparece «CAMBIO A DEVOLVER» con el vuelto exacto.",
          "Confirma la venta.",
        ],
      },
      {
        title: "Cobrar por Transfermóvil o EnZona",
        steps: [
          "En el cobro elige «Transfermóvil» o «EnZona».",
          "Estas pasarelas necesitan internet; sin conexión la app te ofrece cobrar en efectivo o activar el Modo Online.",
          "Elige el estado inicial: «Pago Pendiente» (aún no ha llegado el dinero) o «Ya Confirmado».",
          "Opcional: escribe una nota o el número de referencia de la transferencia.",
          "Confirma la venta.",
        ],
        tips: [
          "Las ventas pendientes se ven en el Historial de Tickets con «⏳ Esperando acreditación». Cuando llegue el dinero, toca «Marcar Pagado».",
        ],
      },
      {
        title: "Pago mixto (parte efectivo y parte transferencia)",
        steps: [
          "En el cobro elige «Mixto».",
          "Escribe en «Parte pagada en efectivo» cuánto entregó el cliente en efectivo.",
          "El resto se registra automáticamente como transferencia. La app te muestra el reparto antes de confirmar.",
        ],
      },
      {
        title: "Ticket, recibo e historial",
        images: [{ file: "recibo.jpg", caption: "Recibo tras la venta: botones PDF, WhatsApp y Telegram arriba; el importe en la moneda del cobro y su equivalente en divisas." }],
        bullets: [
          "Tras cobrar se abre el recibo: puedes imprimirlo, guardarlo en PDF o enviarlo por WhatsApp o Telegram.",
          "El recibo indica la moneda del cobro y «Atendido por» con el nombre del vendedor del turno.",
          "Historial de Tickets (icono de recibo en la barra superior de Caja): todas las ventas, «Ver Recibo» y «Marcar Pagado» para transferencias pendientes.",
        ],
      },
    ],
  },
  {
    id: "monedas",
    icon: "💱",
    title: "Monedas y tasas de cambio",
    summary: "Tasas del mercado informal (elTOQUE) o manuales, con tu propio ajuste por divisa.",
    isNew: true,
    sections: [
      {
        title: "Cómo funcionan las monedas",
        bullets: [
          "La moneda base es el peso cubano (CUP). Precios, costos y totales se guardan en CUP.",
          "USD, EUR y MLC se convierten con la tasa del momento: «1 USD = X CUP».",
          "Los importes se muestran con el código de la moneda (CUP, USD, EUR, MLC), nunca con el signo «$», para evitar confusiones.",
        ],
      },
      {
        title: "Configurar las tasas",
        images: [{ file: "tasas.jpg", caption: "Ajustes → Moneda & Tipos de Cambio: para cada divisa, «elTOQUE» o «Manual», el ajuste en CUP y el botón «Guardar y aplicar tasas»." }],
        steps: [
          "Ve a Ajustes → «Moneda & Tipos de Cambio».",
          "Para cada divisa elige «elTOQUE» (sigue la tasa del mercado informal) o «Manual» (tú escribes el valor).",
          "Con elTOQUE puedes poner un «Ajuste (CUP)»: por ejemplo −10 aplica 10 CUP menos que la tasa de elTOQUE, +15 aplica 15 CUP más.",
          "En «Manual» escribe la tasa: el campo se puede borrar por completo y escribir el número nuevo.",
          "Toca «Guardar y aplicar tasas».",
        ],
      },
      {
        title: "Actualización automática desde elTOQUE",
        bullets: [
          "«Actualizar ahora» consulta las tasas al momento (necesita internet).",
          "Con la casilla de actualización automática, la app consulta al abrirse y cada 3 horas si hay internet.",
          "Las divisas en modo «Manual» nunca se cambian solas.",
          "La tasa de elTOQUE es una referencia del mercado informal; tú decides la que aplicas.",
        ],
        tips: [
          "Si el botón «Actualizar ahora» está gris, falta la clave de la API de elTOQUE: en la misma tarjeta, «Clave de la API de elTOQUE» → «Configurar».",
        ],
      },
    ],
  },
  {
    id: "inventario",
    icon: "📦",
    title: "Inventario y stock",
    summary: "Crear productos con foto, precio, costo y alertas; entradas, mermas y ajustes con historial.",
    sections: [
      {
        title: "Crear un producto",
        images: [{ file: "producto.jpg", caption: "Ficha de producto: foto («Tomar Foto»), nombre, categoría, stock, precio de venta y costo." }],
        steps: [
          "Abre la pestaña «STOCK» y toca «+ AÑADIR PRODUCTO».",
          "Foto: «Tomar Foto» con la cámara o elige una imagen; también puedes usar un icono.",
          "Escribe el nombre (obligatorio). Con una clave de Gemini configurada, «Sugerir con IA» propone categoría y datos.",
          "Elige la categoría.",
          "Escribe el precio de venta y el costo: la app calcula el margen y la ganancia por unidad.",
          "Escribe el stock disponible y el aviso de stock bajo (por ejemplo 5).",
          "Opcional: código de barras / SKU («Generar Código») y color de identificación.",
          "Toca «REGISTRAR PRODUCTO EN CATÁLOGO».",
        ],
        tips: ["Los campos numéricos se pueden borrar por completo antes de escribir; ya no se queda un «0» pegado."],
      },
      {
        title: "Editar o eliminar un producto",
        images: [{ file: "stock.jpg", caption: "Pestaña STOCK: valoración del inventario, botones «Movimiento», «Categorías», PDF y CSV, y avisos de stock bajo." }],
        steps: [
          "En «STOCK» toca el producto para abrir su ficha, cambia lo que necesites y guarda.",
          "Para eliminarlo, usa el botón de eliminar del producto en la lista de STOCK y confirma.",
        ],
        warning: "Eliminar un producto no borra las ventas antiguas, pero ya no se podrá vender.",
      },
      {
        title: "Entradas, mermas y ajustes (Kardex)",
        images: [{ file: "movimiento.jpg", caption: "Registrar Movimiento de Stock: tipo (Entrada, Salida / Merma, Ajuste Físico), producto, cantidad, costo, motivo y responsable." }],
        intro: "Cada cambio de existencias queda registrado con fecha, motivo y responsable.",
        steps: [
          "En «STOCK», toca «Movimiento» en el producto: se abre «Registrar Movimiento de Stock».",
          "Elige el tipo: «Entrada (+)» (compra o reingreso), «Salida / Merma (−)» (rotura, vencimiento) o «Ajuste Físico» (fijar la existencia real).",
          "Escribe la cantidad y, en entradas, el costo unitario.",
          "Elige o escribe el motivo; el responsable se rellena con el usuario del turno.",
          "Toca «Confirmar Movimiento».",
        ],
        tips: ["Consulta todos los movimientos en «Historial / Kardex» de la pestaña STOCK."],
      },
      {
        title: "Alertas de stock bajo",
        bullets: [
          "Cuando un producto baja de su aviso de stock, aparece la campana roja en la barra superior.",
          "Ajustes → «Alertas de Stock & Notificaciones»: sonido, vibración y notificaciones del sistema. «Emitir Alerta de Prueba» comprueba que funcionan.",
        ],
      },
    ],
  },
  {
    id: "usuarios",
    icon: "👤",
    title: "Usuarios, turnos y seguridad",
    summary: "Cada vendedor con su PIN, ventas y cierres a su nombre, y bloqueo de pantalla.",
    isNew: true,
    sections: [
      {
        title: "Activar los usuarios (una sola vez)",
        images: [{ file: "usuarios.jpg", caption: "Ajustes → Usuarios y turnos: turno abierto, lista de usuarios, «Seguridad de la pantalla» y el formulario «Añadir usuario»." }],
        intro: "Es opcional. Mientras no crees usuarios, la app funciona sin PIN.",
        steps: [
          "Ve a Ajustes → «Usuarios y turnos».",
          "Escribe tu nombre y un PIN de 4 a 6 números, repítelo y toca «Crear administrador y activar turnos». El primer usuario siempre es Administrador y su turno queda abierto.",
          "Crea un usuario para cada vendedor: nombre, rol «Vendedor», su PIN y «Crear usuario».",
        ],
        tips: [
          "Crea al menos dos administradores (por ejemplo tú y una persona de confianza): si un administrador olvida su PIN, el otro puede cambiárselo.",
        ],
        warning: "Los PIN no se pueden recuperar. Solo un administrador puede crear usuarios, cambiar PIN o eliminar usuarios.",
      },
      {
        title: "Empezar y cambiar de turno",
        images: [{ file: "turno.jpg", caption: "«¿Quién trabaja ahora?»: cada persona toca su nombre y escribe su PIN." }],
        steps: [
          "Sin turno abierto aparece «¿Quién trabaja ahora?». Cada persona toca su nombre y escribe su PIN.",
          "El nombre del vendedor del turno se ve en la barra superior.",
          "Para cambiar de vendedor, toca ese nombre (o «Cambiar de usuario» en Ajustes) y entra el siguiente con su PIN.",
          "Al registrar el cierre de caja Z, el turno termina y la app pide el siguiente usuario.",
        ],
        bullets: [
          "Cada venta guarda el vendedor; el recibo muestra «Atendido por».",
          "Los movimientos de stock y el cierre Z quedan a nombre del usuario del turno.",
        ],
      },
      {
        title: "Bloquear la pantalla",
        intro: "El bloqueo protege la caja si el teléfono o la tablet se queda sin vigilancia. El turno sigue abierto y la venta en curso no se pierde.",
        bullets: [
          "Candado 🔒 de la barra superior (o «Bloquear ahora» en Ajustes): bloquea al instante.",
          "«Pedir PIN al abrir la app»: pide el PIN al abrir la app y al volver a ella tras más de 30 segundos fuera.",
          "«Bloquear si nadie toca la pantalla durante un tiempo»: escribe los minutos (1 a 240) o usa los botones 1, 2, 5, 10, 15, 30 min o 1 hora. Cada toque reinicia el contador, y cerrar la app no lo reinicia.",
        ],
        tips: ["Las opciones de seguridad están en Ajustes → Usuarios y turnos → «Seguridad de la pantalla». Solo un administrador puede cambiarlas."],
      },
      {
        title: "Desbloquear",
        images: [{ file: "bloqueo.jpg", caption: "Pantalla bloqueada: indica de quién es el turno; «Otro usuario» permite que entre otra persona con su propio PIN." }],
        steps: [
          "En la pantalla bloqueada, escribe el PIN del vendedor del turno o el de un administrador y toca «Entrar».",
          "Si entra otra persona, toca «Otro usuario», elige su nombre y escribe su PIN: empieza su propio turno y lo que venda queda a su nombre.",
        ],
        tips: ["El PIN de otro vendedor no desbloquea el turno de un compañero."],
      },
    ],
  },
  {
    id: "cierre",
    icon: "🧾",
    title: "Cierre de caja (Informe Z)",
    summary: "Arqueo del turno por moneda, calculadora de billetes, ventas por vendedor y descuadres.",
    sections: [
      {
        title: "Qué muestra el cierre",
        bullets: [
          "«Ventas del turno (desde las HH:MM)»: desde el último cierre de hoy; si es el primer cierre del día, desde el inicio del día.",
          "Ventas en efectivo, transferencias, número de tickets y total del turno.",
          "Ventas por vendedor (si hay usuarios).",
          "Responsable del turno: el usuario que hace el cierre.",
        ],
      },
      {
        title: "Hacer el arqueo paso a paso",
        images: [{ file: "cierre-billetes.jpg", caption: "Arqueo: fondo de caja inicial, efectivo contado y la Calculadora de Billetes de Cuba con los billetes de 20.000 y 10.000." }, { file: "cierre-monedas.jpg", caption: "Efectivo por moneda: lo esperado en cada moneda (CUP y divisas) y la casilla para escribir lo contado." }],
        steps: [
          "Abre la pestaña «CIERRE».",
          "Escribe el «Fondo de caja inicial» (el efectivo con el que empezó el turno).",
          "Cuenta el efectivo en CUP con la «Calculadora de Billetes de Cuba» (incluye los billetes de 10.000 y 20.000): escribe cuántas piezas hay de cada billete y la app suma.",
          "En «Efectivo por moneda» escribe lo contado en cada divisa (USD, EUR, MLC) si cobraste en divisas.",
          "Compara «Efectivo teórico esperado» con lo contado: verde = caja cuadrada, azul = sobrante, rojo = faltante.",
          "Opcional: cuenta el inventario físico producto por producto para comparar con el stock del sistema.",
          "Escribe observaciones si hace falta y toca «CERRAR DÍA Y REGISTRAR BALANCE Z».",
        ],
      },
      {
        title: "Después del cierre",
        images: [{ file: "informe-z.jpg", caption: "Informe Z: balance de caja, arqueo por moneda y descuadre, con botones para PDF, CSV, WhatsApp, Telegram, correo y copiar." }],
        bullets: [
          "El Informe Z queda en «Historial de Cierres Registrados» → «Ver Z-Report».",
          "Desde el informe: enviar por WhatsApp o Telegram, correo, copiar el texto o imprimir / guardar PDF con líneas de firma.",
          "«Exportar Historial (CSV)» para abrirlo en Excel o Google Sheets.",
          "Si está activado, se guarda una copia de seguridad automática al cerrar (ver capítulo «Copias de seguridad»).",
          "Al cerrar el informe Z, el turno termina y entra el siguiente vendedor.",
        ],
        tips: ["Puedes hacer varios cierres en el mismo día (uno por turno): cada uno cuenta solo las ventas desde el anterior."],
      },
    ],
  },
  {
    id: "reportes",
    icon: "📊",
    title: "Reportes IPVE",
    summary: "Informe oficial de precios, ventas y existencias con costo, utilidad y firmas.",
    sections: [
      {
        title: "Generar el informe",
        images: [{ file: "ipve.jpg", caption: "Pestaña IPVE: periodo del informe y botones para compartir, imprimir o descargar el documento oficial en PDF." }],
        steps: [
          "Abre la pestaña «IPVE».",
          "Elige el periodo: hoy, semana, mes, mes anterior, todo o un rango «Desde / Hasta».",
          "Revisa los totales: importe vendido, costo de mercancía, ganancia bruta y valor del stock final.",
          "Toca «Descargar Documento Oficial PDF» para guardarlo, compartirlo o imprimirlo.",
        ],
      },
      {
        title: "Personalizar el encabezado y las firmas",
        steps: [
          "Toca «Editar Encabezado».",
          "Cambia el nombre del establecimiento, títulos, responsable, teléfono, dirección y los cargos de las firmas.",
          "«Guardar Cambios». «Valores por defecto» restaura los originales.",
        ],
      },
      {
        title: "Otras opciones",
        bullets: [
          "«Exportar CSV» y «Exportar JSON»: datos del informe para Excel o auditoría.",
          "«Vista Tabla» o «Vista Fichas Móvil» según tu pantalla.",
          "Analista con IA (Google Gemini): preguntas sobre ventas y stock en lenguaje natural (necesita clave de Gemini e internet).",
          "El panel interno de capital inmovilizado y riesgos no se incluye en el PDF oficial.",
        ],
      },
    ],
  },
  {
    id: "envios",
    icon: "🛵",
    title: "Envíos a domicilio",
    summary: "Pedidos desde WhatsApp o Telegram, repartidores propios, agencias y avisos al cliente.",
    sections: [
      {
        title: "Crear un pedido",
        images: [{ file: "envio-nuevo.jpg", caption: "Nuevo pedido a domicilio: «Pegar WhatsApp / Telegram» o el formulario con cliente, teléfono, dirección y productos." }],
        steps: [
          "Abre la pestaña «ENVÍOS» → «+ Nuevo Pedido».",
          "Opción rápida: «Pegar WhatsApp / Telegram», pega el texto de la comanda y toca «Autocompletar Formulario».",
          "Revisa o escribe cliente, teléfono y dirección exacta (opcional: enlace GPS / Google Maps).",
          "Añade los productos.",
          "Escribe tarifa de envío, propina y tiempo estimado.",
          "Elige método de pago (efectivo al entregar o Transfermóvil) y estado del pago.",
          "Guarda el pedido.",
        ],
      },
      {
        title: "Despachar y seguir el pedido",
        steps: [
          "En la tarjeta del pedido toca «Despachar 🛵».",
          "Elige «Repartidor Propio» (de tu lista) o «Agencia Externa» (con código de seguimiento).",
          "Opcional: «Abrir WhatsApp con aviso de despacho» para avisar al cliente.",
          "Toca «Despachar y Poner en Ruta».",
          "Abre el pedido y toca el estado para actualizarlo; al final, «Marcar Entregado» o «Marcar Cancelado».",
        ],
        tips: ["Los botones de WhatsApp y Telegram de cada pedido abren un mensaje editable con plantillas rápidas."],
      },
      {
        title: "Eliminar pedidos",
        isNew: true,
        bullets: [
          "Papelera en cada pedido: lo elimina definitivamente (pide confirmación).",
          "Botón para limpiar todos los pedidos ya entregados o cancelados de una vez.",
          "Una instalación nueva ya no trae pedidos de demostración.",
        ],
      },
      {
        title: "Repartidores y agencias",
        bullets: [
          "Pestaña «Repartidores»: nombre, teléfono, CI, vehículo, chapa, estado y zona. Contacto directo por WhatsApp o Telegram.",
          "Pestaña de agencias: empresas de mensajería con tarifa base, contacto y, opcionalmente, su conexión API (webhook).",
        ],
      },
    ],
  },
  {
    id: "compartir",
    icon: "📤",
    title: "Compartir por WhatsApp y Telegram",
    summary: "Cómo se envían tickets, cierres, pedidos y el ID de activación.",
    isNew: true,
    sections: [
      {
        title: "Dónde se puede compartir",
        bullets: [
          "Activación: enviar el ID del dispositivo.",
          "Recibo de una venta.",
          "Informe Z y resumen del cierre de caja.",
          "Mensajes de pedidos de envío y contacto con repartidores.",
          "Informe IPVE en PDF (con el menú «Compartir» del sistema).",
        ],
      },
      {
        title: "Cómo funciona Telegram",
        intro:
          "La app envía el texto directamente a la app de Telegram, sin pasar por el navegador. Telegram abre su lista de chats con el mensaje listo: elige el chat, grupo o canal y envía.",
        bullets: [
          "Funciona con Telegram y sus variantes habituales (Telegram X, Plus, Nekogram, exteraGram…).",
          "Si no tienes Telegram instalado, aparece el menú de Android para «Compartir con…» otra app.",
        ],
      },
    ],
  },
  {
    id: "dispositivos",
    icon: "📡",
    title: "Varios dispositivos (sincronización)",
    summary: "Cómo trabajan juntos la caja principal y los teléfonos de los camareros: roles, modos de conexión, qué se comparte y seguridad.",
    isNew: true,
    sections: [
      {
        title: "La idea general",
        intro:
          "Varios teléfonos o tablets del mismo negocio pueden trabajar sobre los mismos datos a la vez. Por ejemplo, un camarero toma el pedido de la Mesa 4 en su teléfono y aparece al instante en la caja principal, que cobra. Siempre hay un dispositivo que manda (la caja principal) y los demás se conectan a él.",
      },
      {
        title: "Los dos papeles (roles)",
        bullets: [
          "Terminal principal (Caja central / «Host»): tiene la base de datos maestra (productos, precios, stock, cuentas abiertas y ventas). Debe haber solo uno por negocio.",
          "Cuando un dispositivo se conecta, la caja principal le envía una copia completa del estado actual.",
          "La caja principal hace de repetidor: si un camarero envía un cambio, ella lo reenvía a los demás.",
          "Terminal secundario (Camarero / Comandero): se conecta a la principal y descarga de ella el catálogo, los precios y las mesas. Puede tomar pedidos, añadir productos a las cuentas y vender; cada cambio se envía a la principal.",
          "Si un secundario se desconecta y vuelve, pide otra vez la copia completa a la principal para ponerse al día.",
        ],
        images: [{ file: "sincronizacion.jpg", caption: "«Configuración & Rol»: el rol de este dispositivo (Principal o Secundario) y el modo de conexión (Nube / P2P o Red Local Wi-Fi)." }],
      },
      {
        title: "La clave de sala (PIN de vinculación)",
        intro: "Todos los dispositivos de un negocio comparten una clave de sala, por ejemplo CM-7KQ4-M9XT. Funciona como la llave de un grupo privado: sirve para entrar en la sala y para cifrar todo lo que se envía.",
        bullets: [
          "Solo se escuchan entre sí los dispositivos con la misma clave; los mensajes con otra clave se ignoran.",
          "El código QR que muestra la caja principal contiene esa clave: escanearlo en el secundario evita tener que escribirla.",
          "«Generar Nuevo» cambia la clave: los dispositivos que tenían la antigua quedan fuera y hay que volver a vincularlos.",
          "Si tu sala todavía usa una clave corta antigua (CM- y 4 números), la app muestra «Clave de sala corta» con el botón «Generar clave segura». Úsalo y vuelve a vincular los camareros con el QR nuevo.",
        ],
        images: [{ file: "sync-qr.jpg", caption: "«Vincular / Código QR»: la clave de sala (PIN de vinculación), «Copiar PIN», «Generar Nuevo» y el código QR para los camareros." }],
      },
      {
        title: "Modo A: Red local Wi-Fi (sin internet)",
        bullets: [
          "Todos los dispositivos conectados al mismo router del local.",
          "La caja principal abre un pequeño servidor dentro de la propia app (puerto 8787). Los secundarios se conectan a la dirección IP de la principal en ese Wi-Fi, la que aparece en pantalla (por ejemplo 192.168.1.35).",
          "Ventajas: no necesita internet, es muy rápido y los datos no salen del local.",
          "Requisito: la caja principal debe ser un teléfono o tablet con la app instalada (APK); un navegador no puede abrir un servidor.",
        ],
        tips: ["Si el router se reinicia, la IP de la caja principal puede cambiar: vuelve a vincular los secundarios con la IP nueva."],
      },
      {
        title: "Modo B: Nube / P2P (por internet)",
        intro: "Para dispositivos que no están en el mismo Wi-Fi, o cuando el Wi-Fi del local no deja que los equipos se conecten entre sí.",
        bullets: [
          "Conexión directa entre dispositivos (WebRTC / PeerJS): un servidor público solo sirve para que se «presenten»; después los datos van directamente de un dispositivo a otro.",
          "Servidor de mensajes en la nube (MQTT): si la conexión directa falla, los mensajes pasan por este servidor público.",
          "Las dos vías funcionan a la vez. Cada mensaje lleva un identificador único, así que aunque llegue por las dos se aplica una sola vez.",
          "Requisito: internet en todos los dispositivos.",
          "Los servidores públicos solo ven un código derivado de la clave y mensajes cifrados: no pueden leer tus datos ni deducir la clave.",
        ],
      },
      {
        title: "Qué se comparte",
        bullets: [
          "Cuentas y mesas (crear, cambiar, cerrar): por ejemplo, el camarero añade 2 cervezas a la Mesa 4.",
          "Ventas nuevas: un ticket cobrado en cualquier terminal.",
          "Stock: al vender, baja en todos los dispositivos.",
          "Productos (crear, editar, borrar): por ejemplo, cambias un precio en la caja central.",
          "Categorías: por ejemplo, creas la categoría «Postres».",
          "Copia completa: cuando un dispositivo se conecta o la pide.",
          "Cada pocos segundos los dispositivos se envían una señal de «sigo aquí»; así la lista de equipos conectados sabe quién está en línea.",
        ],
        images: [{ file: "sync-equipos.jpg", caption: "«Equipos Conectados»: las terminales sincronizadas en esta sala, con su rol, modo y estado." }],
      },
      {
        title: "Qué NO se comparte (es de cada dispositivo)",
        bullets: [
          "Usuarios, PIN y turnos: cada teléfono tiene los suyos. Si Ana trabaja en dos teléfonos, hay que crearla en los dos.",
          "El bloqueo de pantalla y sus opciones.",
          "La licencia: cada dispositivo necesita la suya.",
          "Los ajustes de pantalla: modo oscuro, tamaño de letra, márgenes e impresora.",
        ],
      },
      {
        title: "Si dos personas cambian lo mismo",
        bullets: [
          "Gana el último cambio que llega: si dos personas modifican la misma mesa casi a la vez, se queda la versión que llegó la última.",
          "La caja principal es la referencia: al reconectarse, un secundario recibe su copia y se pone al día.",
        ],
        tips: ["Funciona mejor si cada camarero lleva sus propias mesas y se evita que dos personas editen la misma cuenta a la vez."],
      },
      {
        title: "Conectar los dispositivos paso a paso",
        steps: [
          "En la caja principal: Ajustes → «Sincronización Multidispositivo» → «Vincular / Ajustar» → rol «Terminal Principal».",
          "Elige el modo: «Red Local Wi-Fi» (mismo router, sin internet) o «Modo Nube / P2P» (por internet).",
          "Abre la pestaña «Vincular / Código QR»: aparecen el QR y la clave de sala.",
          "En cada teléfono de camarero: rol «Terminal Secundario» → «Escanear QR» y apunta al código (o escribe la clave; en modo Wi-Fi, también la IP de la caja principal).",
          "El secundario descarga todo. Comprueba en «Equipos Conectados» que aparece, o usa «Diagnóstico».",
        ],
        images: [{ file: "sync-diagnostico.jpg", caption: "«Diagnóstico»: estado de la sincronización, vías activas (P2P, nube, Wi-Fi local), paquetes enviados y recibidos, y «Emitir Ping» para probar la conexión." }],
      },
      {
        title: "Seguridad: los mensajes viajan cifrados",
        isNew: true,
        bullets: [
          "Desde la versión 1.4.6, todo lo que se envía entre dispositivos (ventas, productos, cuentas, stock y la copia completa) viaja cifrado (AES-256) con una llave que sale de la clave de sala.",
          "Solo los dispositivos que conocen la clave de sala pueden leer los mensajes o enviar cambios válidos. Un mensaje alterado o sin cifrar se descarta.",
          "En los servidores de internet (modo Nube) la sala aparece con un código derivado de la clave, que no permite deducirla. Lo único visible es el tipo de mensaje (por ejemplo «venta nueva»), nunca su contenido.",
          "Las claves nuevas tienen el formato CM-XXXX-XXXX: hay cientos de miles de millones de combinaciones, mucho más difíciles de adivinar que las antiguas de 4 números.",
          "Todos los dispositivos de la sala deben tener la versión 1.4.6 o superior: un dispositivo con una versión anterior no puede comunicarse con los nuevos.",
        ],
        warning: "La clave de sala es la llave de tus datos compartidos: no la publiques. Si alguien de fuera la ha visto, genera una nueva («Generar Nuevo») y vuelve a vincular tus dispositivos. Para el trabajo diario dentro del local, la Red Local Wi-Fi sigue siendo la opción más privada.",
      },
    ],
  },
  {
    id: "impresoras",
    icon: "🖨️",
    title: "Impresoras térmicas",
    summary: "Bluetooth, Wi-Fi/IP, USB o impresión del sistema (PDF).",
    sections: [
      {
        title: "Vincular una impresora",
        images: [{ file: "impresora.jpg", caption: "Gestión de impresoras: impresoras vinculadas, «Vincular Nueva», «Probar» e «Imprimir con esta»." }],
        steps: [
          "Ajustes → «Impresoras & Terminales Térmicas» → «Gestionar» → «Vincular Nueva».",
          "Elige el tipo: Bluetooth (enciende la impresora y el Bluetooth), Wi-Fi/IP (dirección IP y puerto, normalmente 9100), USB o «Impresora del Sistema» (diálogo de impresión o PDF).",
          "Elige el ancho del papel: 32 columnas (58 mm) o 48 columnas (80 mm).",
          "Opcional: corte automático de papel y apertura del cajón portamonedas.",
          "«Guardar y Vincular Impresora» y luego «Probar».",
        ],
        bullets: [
          "«Imprimir automáticamente al cobrar»: imprime el ticket al registrar cada venta.",
          "«Establecer como Predeterminada» para no elegir la impresora cada vez.",
        ],
      },
    ],
  },
  {
    id: "respaldos",
    icon: "💾",
    title: "Copias de seguridad",
    summary: "Guardar y restaurar todos tus datos. Imprescindible antes de reinstalar o cambiar de teléfono.",
    sections: [
      {
        title: "Hacer una copia",
        images: [{ file: "respaldo.jpg", caption: "Gestor de Respaldos: «Respaldo Total del Sistema (JSON)» guarda todo; también hay copias parciales y CSV." }],
        steps: [
          "Ajustes → «Copias de Seguridad & Respaldos JSON» → «Abrir Gestor de Respaldos».",
          "Elige «Respaldo Total del Sistema (JSON)» para guardarlo todo (productos, ventas, stock, cierres, configuración).",
          "Guarda el archivo o envíalo a tu correo, Google Drive o a ti mismo por WhatsApp o Telegram.",
        ],
        bullets: [
          "También hay copias parciales (solo inventario, solo ventas) y exportaciones CSV para Excel.",
          "«Respaldo Automático al Cerrar Caja»: guarda una copia en cada cierre Z.",
        ],
      },
      {
        title: "Restaurar una copia",
        steps: [
          "En el Gestor de Respaldos toca «Seleccionar Archivo JSON».",
          "Elige el archivo de respaldo. La app comprueba que es válido.",
          "Toca «Confirmar y Restaurar Base de Datos».",
        ],
        warning: "Restaurar reemplaza los datos actuales por los de la copia.",
      },
    ],
  },
  {
    id: "actualizaciones",
    icon: "🔄",
    title: "Actualizaciones de la app",
    summary: "Recibir versiones nuevas sin reinstalar.",
    sections: [
      {
        title: "Actualización automática",
        steps: [
          "Con internet, al abrir la app aparece «Nueva versión disponible» cuando hay una actualización.",
          "Toca instalar. La app descarga la actualización y se reinicia con la versión nueva.",
          "Tus datos no se pierden.",
        ],
        tips: ["Puedes buscar actualizaciones a mano en Ajustes → «Actualizaciones de la App» → «Comprobar GitHub»."],
      },
      {
        title: "Actualización con archivo ZIP (sin internet)",
        steps: [
          "Recibe el archivo ZIP de actualización (por WhatsApp, Telegram, USB…).",
          "Ajustes → «Actualizaciones de la App» → «Instalar Archivo ZIP» y elige el archivo.",
          "Cierra la app por completo y vuelve a abrirla.",
        ],
      },
      {
        title: "Instalar un APK nuevo",
        bullets: [
          "Normalmente un APK nuevo se instala encima sin perder datos.",
          "Si Android dice que hay un conflicto con la app instalada, haz primero una copia de seguridad, desinstala, instala el nuevo APK y restaura la copia.",
          "Si Android bloquea la instalación, permite «Instalar apps de esta fuente» para tu navegador.",
        ],
      },
    ],
  },
  {
    id: "ajustes",
    icon: "⚙️",
    title: "Otros ajustes",
    summary: "Conectividad, inteligencia artificial, licencia y mantenimiento.",
    sections: [
      {
        title: "Opciones",
        bullets: [
          "Modo de conectividad: Offline (todo funciona sin internet) u Online (pasarelas de pago, sincronización por internet, tasas de elTOQUE).",
          "Inteligencia Artificial (Google Gemini): pega tu clave gratuita y toca «Probar Conexión». Se usa para sugerir productos, redactar ofertas y analizar ventas.",
          "Licencia: estado, ID del dispositivo y «Revocar / Reinstalar» (pide confirmación).",
          "«Bloquear Terminal (Cerrar Sesión)»: vuelve a la pantalla de activación.",
          "«Purgar Datos / Restablecer Catálogo»: borra datos para empezar de cero. Haz antes una copia de seguridad.",
        ],
      },
    ],
  },
  {
    id: "problemas",
    icon: "🛟",
    title: "Solución de problemas",
    summary: "Respuestas rápidas a las dudas más comunes.",
    sections: [
      {
        title: "Preguntas frecuentes",
        bullets: [
          "Telegram no se abre al compartir: actualiza la app a la versión 1.4.3 o superior. Si no tienes Telegram, elige otra app en el menú «Compartir con…».",
          "Olvidé mi PIN: otro administrador puede ponerte uno nuevo en Ajustes → Usuarios y turnos → «Cambiar PIN».",
          "La caja no cuadra: revisa el fondo inicial, las ventas por transferencia (no cuentan como efectivo) y el efectivo contado en cada divisa.",
          "Las tasas no se actualizan: necesitas internet y la clave de la API de elTOQUE. Las divisas en «Manual» no se actualizan solas.",
          "Un campo numérico no deja borrar: actualiza a la última versión; ahora todos los campos se pueden vaciar.",
          "Las letras o los botones se ven pequeños: Ajustes → Tema & Modo Visual → «Tamaño y márgenes» → «Tamaño de letra y botones» (por ejemplo «Grande», 115%).",
          "El otro teléfono no se conecta: en Wi-Fi local deben estar en el mismo router; prueba el modo Nube / P2P o revisa «Diagnóstico».",
          "La app pide PIN muy seguido: un administrador puede aumentar los minutos del bloqueo automático o desactivar «Pedir PIN al abrir la app».",
          "No veo el aviso de actualización: comprueba la conexión y toca «Comprobar GitHub» en Ajustes.",
        ],
      },
    ],
  },
];

/** Plain text of a chapter, used by the search box. */
export function chapterSearchText(ch: ManualChapter): string {
  return [
    ch.title,
    ch.summary,
    ...ch.sections.flatMap((s) => [s.title, s.intro || "", ...(s.steps || []), ...(s.bullets || []), ...(s.tips || []), s.warning || ""]),
  ]
    .join(" ")
    .toLowerCase();
}

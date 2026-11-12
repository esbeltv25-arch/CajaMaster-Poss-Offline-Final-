import type { AppState } from "../types";
import { roundCurrency } from "./currency";

export type IPVRow = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  invInicialCant: number;
  invInicialValor: number;
  entradasCant: number;
  entradasValor: number;
  mermasCant: number;
  mermasValor: number;
  dispVentaCant: number;
  dispVentaValor: number;
  invFinalCant: number;
  invFinalValor: number;
  vendidoCant: number;
  precioVenta: number;
  costoUnitario: number;
  importeVendido: number;
  costoTotal: number;
  costoPorVenta: number;
  gananciaBruta: number;
  margenPct: number;
};

export function generateIPVReport(
  state: AppState,
  fromTs: number,
  toTs: number
): IPVRow[] {
  return state.products.map((p) => {
    const cost = Number(p.cost) || 0;
    const price = Number(p.price) || 0;
    const sku = p.barcode || p.id.slice(0, 8).toUpperCase();

    // 1. Sales of this product strictly within period
    const validSalesInPeriod = state.sales.filter(
      (s) =>
        s.ts >= fromTs &&
        s.ts <= toTs &&
        s.paymentStatus !== "CANCELADO" &&
        s.paymentStatus !== "FALLIDO"
    );
    const vendidoCant = validSalesInPeriod
      .flatMap((s) => s.items.filter((i) => i.productId === p.id))
      .reduce((a, b) => a + b.qty, 0);

    // 2. Entries (Reabastecimientos / Compras / Devoluciones) in period
    const entriesInPeriod = (state.movements || []).filter(
      (m) =>
        m.productId === p.id &&
        m.ts >= fromTs &&
        m.ts <= toTs &&
        (m.type === "ENTRY" || m.type === "RETURN" || m.type === "INITIAL")
    );
    const entradasCant = entriesInPeriod.reduce((a, b) => a + b.qty, 0);
    const entradasValor = roundCurrency(
      entriesInPeriod.reduce(
        (a, b) => a + b.qty * (Number(b.unitCost) || cost),
        0
      ) || entradasCant * cost
    );

    // 3. Mermas / Bajas / Pérdidas in period
    const lossesInPeriod = (state.movements || []).filter(
      (m) =>
        m.productId === p.id &&
        m.ts >= fromTs &&
        m.ts <= toTs &&
        m.type === "LOSS"
    );
    const mermasCant = lossesInPeriod.reduce((a, b) => a + b.qty, 0);
    const mermasValor = roundCurrency(mermasCant * cost);

    // 4. Initial stock computation (Back-calculated or from historical movements)
    // Movements before period
    const movsBefore = (state.movements || []).filter(
      (m) => m.productId === p.id && m.ts < fromTs
    );
    const entriesBefore = movsBefore
      .filter((m) => m.type === "ENTRY" || m.type === "RETURN" || m.type === "INITIAL")
      .reduce((a, b) => a + b.qty, 0);
    const lossesBefore = movsBefore
      .filter((m) => m.type === "LOSS")
      .reduce((a, b) => a + b.qty, 0);
    const salesBefore = state.sales
      .filter(
        (s) =>
          s.ts < fromTs &&
          s.paymentStatus !== "CANCELADO" &&
          s.paymentStatus !== "FALLIDO"
      )
      .flatMap((s) => s.items.filter((i) => i.productId === p.id))
      .reduce((a, b) => a + b.qty, 0);

    let invInicialCant = 0;
    if (movsBefore.length > 0 || salesBefore > 0) {
      // Historical movement chain available
      invInicialCant = Math.max(0, entriesBefore - lossesBefore - salesBefore);
    } else {
      // If no movements before period, reconstruct initial stock from live stock and period flows
      // liveStock = invInicial + entradas - mermas - vendido (for period 'all' or active session)
      const reconstructed = p.stock + vendidoCant + mermasCant - entradasCant;
      invInicialCant = Math.max(0, reconstructed);
    }

    // 5. Fundamental Balance Equations:
    // [DISP. VENTA] = [INV. INICIAL] + [ENTRADAS]
    const dispVentaCant = invInicialCant + entradasCant;

    // [INV. FINAL] = [DISP. VENTA] - [MERMAS] - [VENDIDO]
    const invFinalCant = Math.max(
      0,
      dispVentaCant - mermasCant - vendidoCant
    );

    // 6. Financial valuations at unit cost and sale price
    const invInicialValor = roundCurrency(invInicialCant * cost);
    const dispVentaValor = roundCurrency(dispVentaCant * cost);
    const invFinalValor = roundCurrency(invFinalCant * cost);

    const importeVendido = roundCurrency(vendidoCant * price);
    const costoTotal = roundCurrency(vendidoCant * cost);
    const gananciaBruta = roundCurrency(importeVendido - costoTotal);
    const margenPct =
      importeVendido > 0 ? (gananciaBruta / importeVendido) * 100 : 0;
    const costoPorVenta =
      importeVendido > 0 ? roundCurrency(costoTotal / importeVendido) : 0;

    return {
      productId: p.id,
      sku,
      name: p.name,
      unit: p.unit || "u",
      invInicialCant,
      invInicialValor,
      entradasCant,
      entradasValor,
      mermasCant,
      mermasValor,
      dispVentaCant,
      dispVentaValor,
      invFinalCant,
      invFinalValor,
      vendidoCant,
      precioVenta: price,
      costoUnitario: cost,
      importeVendido,
      costoTotal,
      costoPorVenta,
      gananciaBruta,
      margenPct,
    };
  });
}

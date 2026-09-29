import type { AppState } from "../types";
import { roundCurrency } from "./currency";

export type IPVRow = {
  productId: string;
  name: string;
  unit: string;
  invInicialCant: number;
  invInicialValor: number;
  entradasCant: number;
  entradasValor: number;
  dispVentaCant: number;
  dispVentaValor: number;
  invFinalCant: number;
  invFinalValor: number;
  vendidoCant: number;
  precioVenta: number;
  importeVendido: number;
  costoUnitario: number;
  costoTotal: number;
  costoPorVenta: number;
};

export function generateIPVReport(state: AppState, fromTs: number, toTs: number): IPVRow[] {
  return state.products.map(p => {
    // Sales of this product strictly within period
    const salesInPeriod = state.sales
      .filter(s => s.ts >= fromTs && s.ts <= toTs)
      .flatMap(s => s.items.filter(i => i.productId === p.id));
    const vendidoCant = salesInPeriod.reduce((a, b) => a + b.qty, 0);

    // Sales after the period (count toward "after final"), used to back-compute final stock at end of period
    const salesAfter = state.sales
      .filter(s => s.ts > toTs)
      .flatMap(s => s.items.filter(i => i.productId === p.id))
      .reduce((a, b) => a + b.qty, 0);

    // Movements (entries/initials) within period
    const movsInPeriod = state.movements
      .filter(m => m.productId === p.id && m.ts >= fromTs && m.ts <= toTs && m.type !== "INITIAL");
    const entradasCant = movsInPeriod.reduce((a, b) => a + b.qty, 0);
    const entradasValor = roundCurrency(movsInPeriod.reduce((a, b) => a + (b.qty * (b.unitCost || 0)), 0));

    // Movements before period (initial+entries before fromTs)
    const movsBefore = state.movements
      .filter(m => m.productId === p.id && m.ts < fromTs);
    const totalReceivedBefore = movsBefore.reduce((a, b) => a + b.qty, 0);

    // Sales before period
    const salesBefore = state.sales
      .filter(s => s.ts < fromTs && s.paymentStatus !== "CANCELADO" && s.paymentStatus !== "FALLIDO")
      .flatMap(s => s.items.filter(i => i.productId === p.id))
      .reduce((a, b) => a + b.qty, 0);

    // Initial stock at period start = received before - sold before
    const invInicialCant = Math.max(0, totalReceivedBefore - salesBefore);
    // Final stock at period end = current stock + sales after period
    const invFinalCant = Math.max(0, p.stock + salesAfter);
    // Disponible a venta = inicial + entradas
    const dispVentaCant = invInicialCant + entradasCant;

    // Valuations at cost
    const invInicialValor = roundCurrency(invInicialCant * (p.cost || 0));
    const dispVentaValor = roundCurrency(invInicialValor + entradasValor);
    const invFinalValor = roundCurrency(invFinalCant * (p.cost || 0));

    const importeVendido = roundCurrency(vendidoCant * (p.price || 0));
    const costoTotal = roundCurrency(vendidoCant * (p.cost || 0));
    const costoPorVenta = importeVendido > 0 ? roundCurrency(costoTotal / importeVendido) : 0;

    return {
      productId: p.id,
      name: p.name,
      unit: p.unit,
      invInicialCant,
      invInicialValor,
      entradasCant,
      entradasValor,
      dispVentaCant,
      dispVentaValor,
      invFinalCant,
      invFinalValor,
      vendidoCant,
      precioVenta: p.price,
      importeVendido,
      costoUnitario: p.cost,
      costoTotal,
      costoPorVenta,
    };
  });
}

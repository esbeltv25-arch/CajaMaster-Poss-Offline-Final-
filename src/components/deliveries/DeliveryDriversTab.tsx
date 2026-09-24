import { useState } from "react";
import { motion } from "motion/react";
import {
  IconMotorcycle,
  IconBicycle,
  IconCar,
  IconScooter,
  IconFootprints,
  IconPlus,
  IconPhone,
  IconWhatsApp,
  IconTrash,
  IconCheck,
  IconCoins,
} from "../Icons";
import { useStore, actions } from "../../store";
import { formatCurrency } from "../../utils/currency";
import type { DeliveryDriver, DriverStatus, VehicleType } from "../../types";

function getVehicleDetails(type: VehicleType) {
  switch (type) {
    case "MOTORCYCLE":
      return { label: "Moto", icon: "🏍️" };
    case "ELECTRIC_SCOOTER":
      return { label: "Scooter Eléctrico", icon: "⚡" };
    case "BICYCLE":
      return { label: "Bicicleta", icon: "🚲" };
    case "CAR":
      return { label: "Automóvil", icon: "🚗" };
    case "WALK":
      return { label: "A pie", icon: "🚶" };
    default:
      return { label: "Moto", icon: "🏍️" };
  }
}

export function DeliveryDriversTab({
  onOpenNewDriver,
  onEditDriver,
}: {
  onOpenNewDriver: () => void;
  onEditDriver: (driver: DeliveryDriver) => void;
}) {
  const state = useStore();
  const drivers = state.drivers || [];

  const availableCount = drivers.filter((d) => d.status === "AVAILABLE").length;
  const onRouteCount = drivers.filter((d) => d.status === "ON_ROUTE").length;
  const totalCompleted = drivers.reduce((acc, d) => acc + d.totalCompletedDeliveries, 0);
  const totalFeesPaid = drivers.reduce((acc, d) => acc + d.totalFeesEarned, 0);

  const handleStatusChange = (driverId: string, newStatus: DriverStatus) => {
    actions.setDriverStatus(driverId, newStatus);
  };

  const handleResetEarnings = (driver: DeliveryDriver) => {
    if (confirm(`¿Liquidar y reiniciar el balance de comisiones acumuladas de ${driver.name}? (${formatCurrency(driver.totalFeesEarned + driver.totalTipsEarned, "CUP", state.rates)})`)) {
      actions.resetDriverEarnings(driver.id);
    }
  };

  const handleDeleteDriver = (driver: DeliveryDriver) => {
    if (confirm(`¿Seguro que deseas eliminar a ${driver.name} de la flotilla?`)) {
      actions.deleteDeliveryDriver(driver.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              Total Repartidores
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-xs shrink-0">
              👥
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">{drivers.length}</p>
        </div>

        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              Disponibles Ahora
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">
              🟢
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600">{availableCount}</p>
        </div>

        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              En Ruta de Entrega
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs shrink-0">
              🛵
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-600">{onRouteCount}</p>
        </div>

        <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
              Comisiones Totales
            </span>
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0">
              💰
            </span>
          </div>
          <p className="text-sm sm:text-base font-black text-slate-900 truncate">
            {formatCurrency(totalFeesPaid, "CUP", state.rates)}
          </p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
          Flotilla de Conductores y Mensajeros
        </h3>

        <button
          type="button"
          onClick={onOpenNewDriver}
          className="px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
        >
          <IconPlus size={15} />
          <span>+ Registrar Repartidor</span>
        </button>
      </div>

      {/* Drivers List Grid */}
      {drivers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {drivers.map((driver) => {
            const vDetails = getVehicleDetails(driver.vehicleType);
            const isAvailable = driver.status === "AVAILABLE";
            const isOnRoute = driver.status === "ON_ROUTE";

            return (
              <motion.div
                key={driver.id}
                layout
                className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Driver Avatar, Name & Vehicle */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-xl font-bold shadow-2xs shrink-0">
                        {driver.avatarEmoji || vDetails.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-extrabold text-slate-900 truncate">
                          {driver.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                          <span>{vDetails.icon} {vDetails.label}</span>
                          {driver.licensePlate && <span>• {driver.licensePlate}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Status Dropdown */}
                    <select
                      value={driver.status}
                      onChange={(e) => handleStatusChange(driver.id, e.target.value as DriverStatus)}
                      className={`text-[10px] font-extrabold py-1 px-2 rounded-xl border cursor-pointer ${
                        isAvailable
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : isOnRoute
                          ? "bg-blue-50 text-blue-800 border-blue-300"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      <option value="AVAILABLE">🟢 Disponible</option>
                      <option value="ON_ROUTE">🔵 En Ruta</option>
                      <option value="OFF_DUTY">⚪ Fuera Servicio</option>
                    </select>
                  </div>

                  {/* Phone & Contact Buttons */}
                  <div className="flex items-center gap-2 mb-3">
                    <a
                      href={`tel:${driver.phone}`}
                      className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <IconPhone size={13} />
                      <span>{driver.phone}</span>
                    </a>

                    <a
                      href={`https://wa.me/53${driver.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1 transition"
                    >
                      <IconWhatsApp size={14} />
                      <span>Chat</span>
                    </a>
                  </div>

                  {/* Stats Box */}
                  <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-2 gap-2 text-center mb-3">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Entregas</p>
                      <p className="text-xs font-black text-slate-900">
                        {driver.totalCompletedDeliveries} viajes
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Comisiones</p>
                      <p className="text-xs font-black text-amber-700">
                        {formatCurrency(driver.totalFeesEarned + (driver.totalTipsEarned || 0), "CUP", state.rates)}
                      </p>
                    </div>
                  </div>

                  {driver.notes && (
                    <p className="text-[10px] text-slate-500 italic mb-2 line-clamp-1">
                      📌 {driver.notes}
                    </p>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => handleResetEarnings(driver)}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                  >
                    <IconCoins size={12} />
                    <span>Liquidar / Reset</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditDriver(driver)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDriver(driver)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 px-4 text-center bg-white rounded-3xl border border-slate-200/80 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-xl">
            🛵
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">
            No hay repartidores registrados en la flotilla
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Registra a tus mensajeros propios para gestionar entregas, calcular comisiones por viaje y hacer seguimiento.
          </p>
          <button
            type="button"
            onClick={onOpenNewDriver}
            className="mt-2 px-4 py-2 bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-xs hover:bg-slate-800 transition cursor-pointer"
          >
            + Registrar Primer Conductor
          </button>
        </div>
      )}
    </div>
  );
}

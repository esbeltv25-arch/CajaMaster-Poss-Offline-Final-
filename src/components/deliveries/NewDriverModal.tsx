import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import {
  IconX,
  IconMotorcycle,
  IconBicycle,
  IconCar,
  IconScooter,
  IconFootprints,
} from "../Icons";
import { actions } from "../../store";
import type { DeliveryDriver, DriverStatus, VehicleType } from "../../types";

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: string }[] = [
  { type: "MOTORCYCLE", label: "Motocicleta / Moto", icon: "🏍️" },
  { type: "ELECTRIC_SCOOTER", label: "Moto Eléctrica / Scooter", icon: "⚡" },
  { type: "BICYCLE", label: "Bicicleta / Ciclo", icon: "🚲" },
  { type: "CAR", label: "Automóvil / Auto", icon: "🚗" },
  { type: "WALK", label: "A pie / Mensajero", icon: "🚶" },
];

export function NewDriverModal({
  driverToEdit,
  isOpen,
  onClose,
}: {
  driverToEdit?: DeliveryDriver | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(driverToEdit?.name || "");
  const [phone, setPhone] = useState(driverToEdit?.phone || "");
  const [identityNumber, setIdentityNumber] = useState(driverToEdit?.identityNumber || "");
  const [vehicleType, setVehicleType] = useState<VehicleType>(driverToEdit?.vehicleType || "MOTORCYCLE");
  const [licensePlate, setLicensePlate] = useState(driverToEdit?.licensePlate || "");
  const [status, setStatus] = useState<DriverStatus>(driverToEdit?.status || "AVAILABLE");
  const [notes, setNotes] = useState(driverToEdit?.notes || "");
  const [avatarEmoji, setAvatarEmoji] = useState(
    driverToEdit?.avatarEmoji || (vehicleType === "ELECTRIC_SCOOTER" ? "⚡" : vehicleType === "BICYCLE" ? "🚲" : "🏍️")
  );

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert("Por favor completa el nombre y teléfono del repartidor.");
      return;
    }

    if (driverToEdit) {
      actions.updateDeliveryDriver(driverToEdit.id, {
        name: name.trim(),
        phone: phone.trim(),
        identityNumber: identityNumber.trim() || undefined,
        vehicleType,
        licensePlate: licensePlate.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
        avatarEmoji,
      });
    } else {
      actions.addDeliveryDriver({
        name: name.trim(),
        phone: phone.trim(),
        identityNumber: identityNumber.trim() || undefined,
        vehicleType,
        licensePlate: licensePlate.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
        avatarEmoji,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <IconMotorcycle size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                {driverToEdit ? "Editar Repartidor" : "Nuevo Repartidor / Flotilla"}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Personal de entrega propio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form id="driver-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Carlos Mendoza"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Teléfono / WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 52345678"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Carnet de Identidad (CI):
              </label>
              <input
                type="text"
                value={identityNumber}
                onChange={(e) => setIdentityNumber(e.target.value)}
                placeholder="Ej. 92041512345"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Matrícula / Chapa del Vehículo:
              </label>
              <input
                type="text"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="Ej. P-452109"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Vehicle Type Picker */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
              Tipo de Vehículo de Transporte:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {VEHICLE_OPTIONS.map((v) => (
                <button
                  key={v.type}
                  type="button"
                  onClick={() => {
                    setVehicleType(v.type);
                    setAvatarEmoji(v.icon);
                  }}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    vehicleType === v.type
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span>{v.icon}</span>
                  <span className="truncate">{v.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Estado Operativo:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DriverStatus)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
              >
                <option value="AVAILABLE">🟢 Disponible para Entregas</option>
                <option value="ON_ROUTE">🔵 En Ruta de Despacho</option>
                <option value="OFF_DUTY">⚪ Fuera de Servicio / Descanso</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Emoji Distintivo:
              </label>
              <input
                type="text"
                value={avatarEmoji}
                onChange={(e) => setAvatarEmoji(e.target.value)}
                placeholder="🏍️"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-center font-bold text-base"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Notas / Zona Habitual de Cobertura:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Zona Vedado, Plaza y Playa..."
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="driver-form"
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
          >
            {driverToEdit ? "Guardar Cambios" : "Registrar Repartidor"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

#!/usr/bin/env python3
"""
CajaMaster - Generador de Claves de Activación (macOS / Python 3)
Uso:
  python3 scripts/generate-license.py [ID_DISPOSITIVO]
  O ejecuta sin argumentos para modo interactivo.
"""

import sys
import hashlib
import subprocess

SECRET = "CAJAMASTER_2026"

def compute_key(device_id: str) -> str:
    clean_id = (device_id or "").strip().upper()
    if not clean_id:
        return ""
    data = (clean_id + SECRET).encode("utf-8")
    hex_digest = hashlib.sha256(data).hexdigest()
    k = hex_digest[:16].upper()
    return f"{k[0:4]}-{k[4:8]}-{k[8:12]}-{k[12:16]}"

def copy_to_clipboard(text: str):
    if sys.platform == "darwin":
        try:
            p = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE, close_fds=True)
            p.communicate(input=text.encode("utf-8"))
            return True
        except Exception:
            return False
    return False

def print_result(device_id: str, key: str):
    clean_id = device_id.strip().upper()
    print("\n=======================================================")
    print("             🔑 CAJAMASTER - LICENCIA GENERADA         ")
    print("=======================================================")
    print(f"📱 ID de Dispositivo : {clean_id}")
    print(f"🔐 Clave de Activación: \033[1;32m{key}\033[0m")
    print("=======================================================")
    print("ℹ️  Esta clave es válida únicamente para este ID de dispositivo.")
    print("   El usuario solo debe ingresarla una única vez.")
    print("=======================================================")

    if copy_to_clipboard(key):
        print("📋 ¡Clave copiada automáticamente al portapapeles de tu Mac!\n")
    else:
        print()

def main():
    if len(sys.argv) > 1:
        device_id = sys.argv[1]
        key = compute_key(device_id)
        if key:
            print_result(device_id, key)
        else:
            print("❌ ID de dispositivo inválido.")
        return

    print("\n=======================================================")
    print("   🏪 CajaMaster - Generador de Claves de Licencia     ")
    print("=======================================================")
    try:
        user_input = input("Introduce el ID del dispositivo del cliente (ej. CM-ABCD-EFGH-1234): ")
        key = compute_key(user_input)
        if key:
            print_result(user_input, key)
        else:
            print("❌ Error: No se proporcionó ningún ID válido.")
    except (KeyboardInterrupt, EOFError):
        print("\nOperación cancelada.")

if __name__ == "__main__":
    main()

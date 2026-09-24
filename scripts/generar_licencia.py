#!/usr/bin/env python3
"""
GENERADOR DE LICENCIAS ADMINISTRATIVO - PUNTO DE VENTA (CAJAMASTER POS)
======================================================================
Este script permite al propietario/administrador generar licencias
offline para clientes basadas en el Device ID único de su equipo.

Uso:
    python3 scripts/generar_licencia.py
    o:
    python3 scripts/generar_licencia.py DEV-A1B2-C3D4-E5F6
"""

import hmac
import hashlib
import sys

# IMPORTANTE: Esta clave debe ser exactamente la misma definida dentro de la App
SECRET_KEY = b"MiClaveSuperSecretaDelPuntoDeVenta2026"

def generar_licencia(device_id: str) -> str:
    """
    Genera un código de activación único de 12 caracteres basado en el Device ID.
    """
    # Normalizar el Device ID (quitar espacios y convertir a minúsculas)
    clean_device_id = device_id.strip().lower().encode('utf-8')
    
    # Calcular HMAC-SHA256
    hash_hmac = hmac.new(SECRET_KEY, clean_device_id, hashlib.sha256).hexdigest()
    
    # Formatear el resultado en bloques para facilitar la lectura (Ejemplo: A1B2-C3D4-E5F6)
    raw_code = hash_hmac[:12].upper()
    formatted_code = f"{raw_code[:4]}-{raw_code[4:8]}-{raw_code[8:12]}"
    
    return formatted_code

if __name__ == "__main__":
    print("=" * 50)
    print(" GENERADOR OFICIAL DE LICENCIAS - CAJAMASTER POS")
    print("=" * 50)
    
    if len(sys.argv) > 1:
        dev_id = sys.argv[1]
    else:
        dev_id = input("\nIngrese el Device ID proporcionado por el cliente: ")
        
    if dev_id and dev_id.strip():
        licencia = generar_licencia(dev_id)
        print(f"\nDispositivo: {dev_id.strip().upper()}")
        print(f"-> Contraseña / Clave de Activación: {licencia}\n")
    else:
        print("\n[Error] El Device ID no puede estar vacío.\n")

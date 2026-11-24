#!/usr/bin/env node
/**
 * Builds Generador_CajaMaster_POS.html: a single, offline HTML file for the app OWNER
 * to issue licenses. It embeds the app's PUBLIC key (to warn if the private key
 * does not match) but never contains the private key: that is loaded at use time.
 *
 *   npm run license:generator
 *
 * The output stays in the project root (NOT in public/), so it is never shipped
 * inside the APK or the OTA bundles.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pubTs = fs.readFileSync(path.join(root, "src/utils/licensePublicKey.ts"), "utf-8");
const publicKey = (pubTs.match(/LICENSE_PUBLIC_KEY_HEX = "([0-9a-fA-F]*)"/) || [])[1] || "";

const result = await build({
  entryPoints: [path.join(root, "scripts/license-generator/generator.ts")],
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
  target: "es2019",
  define: { __APP_PUBLIC_KEY__: JSON.stringify(publicKey) },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Generador de Licencias</title>
<style>
  :root { --bg:#0b1a16; --card:#12271f; --ink:#e8f3ee; --muted:#8fb3a5; --accent:#fbbf24; --ok:#34d399; --bad:#fb7185; --line:#24463a; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  main { max-width:720px; margin:0 auto; padding:20px 16px 48px; }
  h1 { font-size:20px; margin:0 0 4px; } h2 { font-size:15px; margin:0 0 10px; color:var(--accent); }
  p.sub { margin:0 0 18px; color:var(--muted); font-size:13px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; margin-bottom:14px; }
  label { display:block; font-size:12px; font-weight:700; color:var(--muted); margin:10px 0 4px; text-transform:uppercase; letter-spacing:.04em; }
  input, select, textarea { width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:#0a1813; color:var(--ink); font:inherit; }
  textarea { min-height:80px; font-family:ui-monospace,Menlo,monospace; font-size:12px; }
  button, a.btn { display:inline-block; padding:10px 14px; border-radius:10px; border:0; font-weight:800; cursor:pointer; text-decoration:none; font-size:14px; }
  .primary { background:var(--accent); color:#111; } .ghost { background:#1d3a30; color:var(--ink); }
  .row { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
  .mono { font-family:ui-monospace,Menlo,monospace; word-break:break-all; }
  #license { font-size:13px; background:#07120e; border:1px dashed var(--accent); padding:12px; border-radius:10px; color:var(--accent); }
  .warn { color:var(--bad); font-size:13px; font-weight:700; } .muted { color:var(--muted); font-size:12px; }
  table { width:100%; border-collapse:collapse; font-size:12px; } td { padding:6px 4px; border-top:1px solid var(--line); vertical-align:top; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0 10px; } @media (max-width:520px){ .grid{ grid-template-columns:1fr; } }
</style>
</head>
<body>
<main>
  <h1>🔑 CajaMaster POS · Generador de Licencias</h1>
  <p class="sub">Solo para el propietario. Funciona sin internet. Cada licencia queda firmada para un único dispositivo.</p>

  <section class="card" id="key-setup" hidden>
    <h2>1. Carga tu clave privada</h2>
    <p class="muted">Abre el archivo <span class="mono">.license/private-key.json</span> (creado con <span class="mono">npm run license:keygen</span>) o pega su contenido. Se guarda solo en este navegador.</p>
    <label for="key-file">Archivo</label><input type="file" id="key-file" accept=".json,.txt" />
    <label for="key-input">o pega el contenido</label><textarea id="key-input" placeholder='{"privateKeyHex": "..."}'></textarea>
    <div class="row"><button class="primary" id="key-save">Guardar clave en este navegador</button></div>
  </section>

  <section class="card" id="key-ok" hidden>
    <h2>Clave cargada ✅</h2>
    <div class="muted">Clave pública derivada:</div><div class="mono muted" id="key-pub"></div>
    <div class="muted" style="margin-top:6px">Clave pública de la app:</div><div class="mono muted" id="app-pub"></div>
    <p class="warn" id="key-warn"></p>
    <div class="row"><button class="ghost" id="key-forget">Olvidar clave en este navegador</button></div>
  </section>

  <section class="card" id="gen-card" hidden>
    <h2>2. Generar licencia</h2>
    <label for="device">ID del dispositivo del cliente</label>
    <input id="device" placeholder="CM-AB12-CD34-EF56" autocapitalize="characters" autocomplete="off" />
    <div class="grid">
      <div><label for="duration">Duración</label>
        <select id="duration">
          <option value="perm">Permanente</option><option value="30">30 días</option><option value="90">90 días</option>
          <option value="180">6 meses</option><option value="365">1 año</option><option value="date">Hasta una fecha…</option>
        </select></div>
      <div id="until-wrap" hidden><label for="until">Fecha de caducidad</label><input type="date" id="until" /></div>
    </div>
    <label for="client">Cliente (opcional, solo para tu registro)</label><input id="client" placeholder="Nombre del negocio" />
    <div class="row"><button class="primary" id="gen">Generar licencia</button></div>
    <div id="result" hidden style="margin-top:14px">
      <div class="muted" id="lic-info"></div>
      <div id="license" class="mono"></div>
      <div class="row">
        <button class="primary" id="copy">Copiar licencia</button>
        <a class="btn ghost" id="wa" target="_blank" rel="noopener">Enviar por WhatsApp</a>
        <a class="btn ghost" id="tg" target="_blank" rel="noopener">Enviar por Telegram</a>
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Licencias emitidas en este navegador (<span id="reg-count">0</span>)</h2>
    <table><tbody id="reg-body"></tbody></table>
    <div class="row"><button class="ghost" id="csv">Exportar registro (CSV)</button></div>
  </section>
</main>
<script>${js}</script>
</body>
</html>
`;

const out = path.join(root, "Generador_CajaMaster_POS.html");
fs.writeFileSync(out, html);
console.log(`✅ Generador creado: Generador_CajaMaster_POS.html (${Math.round(html.length / 1024)} KB)`);
console.log(publicKey ? `   Clave pública de la app: ${publicKey}` : "   ⚠️ La app aún no tiene clave pública: ejecuta antes npm run license:keygen");

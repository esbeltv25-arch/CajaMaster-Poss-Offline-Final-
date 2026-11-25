import { useMemo, useState, type Key } from "react";
import { MANUAL_CHAPTERS, MANUAL_EDITION, chapterSearchText, manualImageUrl, type ManualChapter } from "../content/userManual";
import { generateDetailedManualPdf } from "../utils/detailedManualPdf";
import { useStore } from "../store";
import { IconDownload, IconSearch } from "./Icons";

/**
 * «Manual completo»: the detailed, step-by-step manual inside the app, with search,
 * one chapter per function and the option to download it as a PDF.
 */
export function FullManualView() {
  const state = useStore();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const chapters = useMemo(
    () => (q ? MANUAL_CHAPTERS.filter((c) => q.split(/\s+/).every((w) => chapterSearchText(c).includes(w))) : MANUAL_CHAPTERS),
    [q]
  );

  const download = async (share: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      const ok = await generateDetailedManualPdf(state.business?.name || "CajaMaster POS", share);
      setMsg(ok ? "✓ Manual detallado generado." : "No se pudo generar el PDF.");
    } catch {
      setMsg("No se pudo generar el PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" id="full-manual">
      <div className="rounded-2xl bg-slate-900 text-white p-3.5 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-extrabold text-sm">📘 Manual completo paso a paso</div>
            <div className="text-[11px] text-white/60">
              {MANUAL_CHAPTERS.length} capítulos · {MANUAL_EDITION}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              id="btn-download-detailed-manual"
              disabled={busy}
              onClick={() => download(false)}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <IconDownload size={13} /> {busy ? "Generando..." : "Descargar PDF"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => download(true)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
            >
              Compartir
            </button>
          </div>
        </div>
        {msg && <div className="text-[11px] font-bold text-amber-300">{msg}</div>}
        <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 h-9">
          <IconSearch size={14} className="text-white/60 shrink-0" />
          <input
            id="manual-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: PIN, Telegram, tasas, cierre, impresora…"
            className="flex-1 min-w-0 bg-transparent outline-none text-xs font-semibold placeholder:text-white/40"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-xs font-bold text-white/60 cursor-pointer">
              ✕
            </button>
          )}
        </div>
      </div>

      {chapters.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-6">No hay resultados para «{query}». Prueba con otra palabra.</p>
      )}

      <div className="space-y-2">
        {chapters.map((ch) => (
          <ChapterCard
            key={ch.id}
            chapter={ch}
            open={openId === ch.id || (q.length > 0 && chapters.length <= 3)}
            onToggle={() => setOpenId(openId === ch.id ? null : ch.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ChapterCard({ chapter, open, onToggle }: { key?: Key; chapter: ManualChapter; open: boolean; onToggle: () => void }) {
  const num = MANUAL_CHAPTERS.indexOf(chapter) + 1;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden" id={`manual-ch-${chapter.id}`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left cursor-pointer hover:bg-slate-50">
        <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">{chapter.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-extrabold text-sm text-slate-900">
              {num}. {chapter.title}
            </span>
            {chapter.isNew && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-black">NUEVO</span>
            )}
          </span>
          <span className="block text-[11px] text-slate-500 leading-snug">{chapter.summary}</span>
        </span>
        <span className="text-slate-400 font-black shrink-0">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
          {chapter.sections.map((s, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <h4 className="font-extrabold text-xs text-slate-900">
                  {num}.{i + 1} {s.title}
                </h4>
                {s.isNew && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-black">NUEVO</span>
                )}
              </div>
              {s.intro && <p className="text-[11.5px] text-slate-600 leading-relaxed">{s.intro}</p>}
              {s.steps && (
                <ol className="space-y-1">
                  {s.steps.map((st, k) => (
                    <li key={k} className="flex gap-2 text-[11.5px] text-slate-700 leading-relaxed">
                      <span className="w-5 h-5 rounded-md bg-slate-900 text-amber-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        {k + 1}
                      </span>
                      <span className="min-w-0">{st}</span>
                    </li>
                  ))}
                </ol>
              )}
              {s.bullets && (
                <ul className="space-y-1">
                  {s.bullets.map((b, k) => (
                    <li key={k} className="flex gap-2 text-[11.5px] text-slate-700 leading-relaxed">
                      <span className="text-amber-500 font-black shrink-0">•</span>
                      <span className="min-w-0">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.tips?.map((t, k) => (
                <p key={k} className="rounded-xl bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 text-[11px] text-emerald-800 leading-relaxed">
                  💡 {t}
                </p>
              ))}
              {s.warning && (
                <p className="rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-900 leading-relaxed">
                  ⚠️ {s.warning}
                </p>
              )}
              {s.images?.map((img) => (
                <figure key={img.file} className="pt-1 flex flex-col items-center gap-1.5">
                  <img
                    src={manualImageUrl(img.file)}
                    alt={img.caption}
                    loading="lazy"
                    className="w-full max-w-[260px] rounded-2xl border border-slate-200 shadow-sm bg-slate-100"
                  />
                  <figcaption className="text-[10.5px] text-slate-500 text-center leading-snug max-w-[300px]">{img.caption}</figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

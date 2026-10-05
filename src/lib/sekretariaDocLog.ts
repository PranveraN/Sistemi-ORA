// Regjistron në arkiv një dokument të printuar nga Sekretaria (vërtetim/kontratë).
// Best-effort: s'pret përgjigje dhe s'e ndalon kurrë printimin nëse dështon.
export function logSekretariaDocument(doc: {
  type: "VERTETIM_NXENES" | "VERTETIM_MESIMDHENES" | "VERTETIM_ASISTENTE" | "KONTRATE_NXENES" | "KONTRATE_MESIMDHENES";
  personName: string;
  studentId?: number | null;
  staffId?: number | null;
  className?: string | null;
  data?: unknown;
}): void {
  try {
    fetch("/api/sekretaria/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    }).catch(() => {});
  } catch { /* s'ndikon printimin */ }
}

/** Lexon një dokument të arkivit për ta rihapur (?archiveId=). */
export async function loadSekretariaDocument(id: string | number): Promise<{ type: string; studentId: number | null; staffId: number | null; studentName: string; className: string | null; data: Record<string, unknown> } | null> {
  try {
    const r = await fetch(`/api/sekretaria/documents/${id}`);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

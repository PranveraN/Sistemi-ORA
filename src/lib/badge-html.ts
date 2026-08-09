import { PERIOD_BUCKETS } from "./food-periods";

export interface BadgeStudent {
  id: number;
  firstName: string;
  lastName: string;
  className: string;
}

const SHORT_LABELS = ["Sht/Tet", "Nën/Dhj", "Jan/Shk", "Mar/Pri", "Maj/Qer"];

const SCHOOL_YEAR = "2026/2027";
const NOTE = `Bexhi vlen për vitin shkollor ${SCHOOL_YEAR}. Pagesa bëhet çdo dy muaj, nga data 1 deri më 5 të muajit. Në rast humbjeje ose dëmtimi, bexh i ri kushton 5&nbsp;€.`;

export const BADGE_CSS = `
.badge {
  width: 90mm; height: 55mm;
  border: 0.4mm solid #cbd5e1; border-radius: 3.5mm;
  padding: 3.5mm 4mm 3mm;
  box-sizing: border-box;
  display: flex; flex-direction: column;
  font-family: Arial, Helvetica, sans-serif;
  position: relative; overflow: hidden;
  page-break-inside: avoid; break-inside: avoid;
}
.badge-accent {
  position: absolute; top: 0; left: 0; right: 0; height: 2.5mm;
  background: linear-gradient(90deg, #7c3aed, #a78bfa);
}
.badge-top { display: flex; gap: 3mm; margin-top: 1.5mm; }
.badge-photo {
  width: 22mm; height: 24mm; flex-shrink: 0;
  border: 0.3mm solid #e2e8f0; border-radius: 2mm; overflow: hidden;
  background: #f1f5f9; display: flex; align-items: center; justify-content: center;
}
.badge-photo img { width: 100%; height: 100%; object-fit: cover; }
.badge-photo-placeholder { font-size: 20px; font-weight: bold; color: #94a3b8; }
.badge-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.badge-name { font-size: 13.5px; font-weight: 800; color: #111; line-height: 1.15; }
.badge-class { font-size: 9.5px; color: #64748b; margin-top: 0.8mm; font-weight: 600; }
.badge-note { font-size: 6.6px; line-height: 1.35; color: #7c8494; margin-top: 1.8mm; }
.badge-brand { margin-top: auto; font-size: 8px; color: #7c3aed; font-weight: 800; letter-spacing: 0.06em; }
.badge-stamp-title { font-size: 6.8px; color: #94a3b8; font-weight: 700; letter-spacing: 0.06em; margin-top: 2mm; }
.badge-stamps { display: flex; justify-content: space-between; gap: 1.5mm; margin-top: 1mm; }
.badge-stamp { display: flex; flex-direction: column; align-items: center; gap: 0.7mm; flex: 1; }
.badge-stamp-box {
  width: 100%; aspect-ratio: 1 / 1; max-width: 11mm;
  border: 0.4mm dashed #94a3b8; border-radius: 1.3mm;
}
.badge-stamp-label { font-size: 6.5px; color: #475569; font-weight: 700; }
`;

export function buildBadgeCardHTML(s: BadgeStudent): string {
  const initials = `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase();
  const stamps = PERIOD_BUCKETS.map((_, i) => `
    <div class="badge-stamp">
      <div class="badge-stamp-box"></div>
      <div class="badge-stamp-label">${SHORT_LABELS[i]}</div>
    </div>`).join("");
  return `
<div class="badge">
  <div class="badge-accent"></div>
  <div class="badge-top">
    <div class="badge-photo">
      <img src="/api/students/${s.id}/photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
      <div class="badge-photo-placeholder" style="display:none">${initials}</div>
    </div>
    <div class="badge-info">
      <div class="badge-name">${s.firstName} ${s.lastName}</div>
      <div class="badge-class">Klasa: ${s.className || "—"}</div>
      <div class="badge-note">${NOTE}</div>
      <div class="badge-brand">AKADEMIA ORA</div>
    </div>
  </div>
  <div class="badge-stamp-title">VULA E PAGESËS</div>
  <div class="badge-stamps">${stamps}</div>
</div>`;
}

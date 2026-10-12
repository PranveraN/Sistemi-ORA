"use client";

// "Për vitin shkollor" — për shpenzimet dhe dorëzimet. Parazgjedhur: sipas datës.
// Zgjidhet veç kur paratë i takojnë një viti tjetër nga data reale, p.sh. faturë
// ose dorëzim i gushtit me paratë e pagesave të hershme të 2026–27. Data reale
// s'ndryshon; ndikon vetëm pamjen "vit shkollor" (Pasqyra e vitit).

/** Viti shkollor (viti fillestar) i një date "YYYY-MM-DD": shtator–dhjetor → ai vit; janar–gusht → viti i kaluar. */
export function schoolYearOfDate(date: string): number | null {
  const [y, m] = date.split("-").map(Number);
  if (!y || !m) return null;
  return m >= 9 ? y : y - 1;
}
export const schoolYearLabel = (start: number) => `${start}–${start + 1}`;

export default function SchoolYearSelect({ date, value, onChange, id = "viti-shkollor" }: {
  date: string; value: number | null; onChange: (v: number | null) => void; id?: string;
}) {
  const auto = schoolYearOfDate(date);
  const options = auto == null ? [] : [auto - 1, auto, auto + 1];
  if (value != null && !options.includes(value)) options.push(value);
  return (
    <div>
      <label htmlFor={id} className="form-label">Për vitin shkollor</label>
      <select id={id} className="form-input" value={value ?? ""} onChange={e => onChange(e.target.value ? parseInt(e.target.value) : null)}>
        <option value="">Sipas datës{auto != null ? ` (${schoolYearLabel(auto)})` : ""}</option>
        {options.filter(y => y !== auto).sort().map(y => <option key={y} value={y}>{schoolYearLabel(y)}</option>)}
      </select>
      {value != null && value !== auto && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
          Data reale mbetet {date.split("-").reverse().join(".")} (për arkën). Te Pasqyra e vitit numërohet te {schoolYearLabel(value)}.
        </p>
      )}
    </div>
  );
}

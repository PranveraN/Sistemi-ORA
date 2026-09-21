// Rregull i thjeshtë biznesi: nëse administrata s'ka caktuar shprehimisht një
// kapacitet për një paralele, kufiri i nënkuptuar është 25 nxënës — vetëm për
// kontrollin e vendeve/listën e pritjes te aplikimi publik (/apliko). NUK
// pengon administratën të regjistrojë manualisht më shumë se 25 nxënës në një
// klasë direkt në sistem — kjo fushë përdoret VETËM këtu, jo si validim i
// përgjithshëm te Student/Class.
export const DEFAULT_CLASS_CAPACITY = 25;

export function classHasRoom(capacity: number | null, activeStudentCount: number): boolean {
  const effectiveCapacity = capacity ?? DEFAULT_CLASS_CAPACITY;
  return activeStudentCount < effectiveCapacity;
}

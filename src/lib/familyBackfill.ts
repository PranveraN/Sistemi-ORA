import { prisma } from "./prisma";
import { groupByPhone, suggestNameMerges, primaryOf, phoneKey, type FamilyStudentLite } from "./families";

// Lidhja fillestare e nxënësve me familjet (Super Admin) — vetëm për nxënësit
// që s'kanë ende familje. Pamja paraprake s'shkruan asgjë; ekzekutimi zbaton
// grupimin sipas telefonit + VETËM sugjerimet sipas emrit që u zgjodhën.

async function load(orgId: number) {
  const students = await prisma.student.findMany({
    where: { organizationId: orgId, familyRefId: null },
    select: {
      id: true, firstName: true, lastName: true, status: true,
      parentPhone: true, fatherPhone: true, motherPhone: true, parentName: true, fatherName: true, motherName: true,
      class: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const { groups, conflicts } = groupByPhone(students as FamilyStudentLite[]);
  const suggestions = suggestNameMerges(students as FamilyStudentLite[], groups);
  return { students, groups, conflicts, suggestions };
}

export async function previewFamilyBackfill(orgId: number) {
  const { students, groups, conflicts, suggestions } = await load(orgId);
  const byId = new Map(students.map(s => [s.id, s]));
  const label = (id: number) => { const s = byId.get(id)!; return `${s.firstName} ${s.lastName}${s.class ? ` (${s.class.name})` : ""}${s.status !== "ACTIVE" ? " · joaktiv" : ""}`; };
  const phonesLabel = (ids: number[]) => [...new Set(ids.flatMap(id => { const s = byId.get(id)!; return [s.fatherPhone, s.motherPhone, s.parentPhone].filter(Boolean) as string[]; }))].join(", ");
  return {
    studentsWithoutFamily: students.length,
    familiesToCreate: groups.length,
    multiChild: groups.filter(g => g.filter(id => byId.get(id)!.status === "ACTIVE").length >= 2).length,
    withoutPhone: students.filter(s => ![s.parentPhone, s.fatherPhone, s.motherPhone].some(p => phoneKey(p))).length,
    conflicts: conflicts.map(c => ({ phone: c.phone, students: c.students.map(s => label(s.id)) })),
    suggestions: suggestions.map(sg => ({
      key: sg.key,
      parentNames: sg.parentNames,
      groups: sg.groupIndexes.map(gi => ({ students: groups[gi].map(label), phones: phonesLabel(groups[gi]) || "pa telefon" })),
    })),
  };
}

export async function runFamilyBackfill(orgId: number, acceptedKeys: string[]) {
  const { students, groups, suggestions } = await load(orgId);
  const byId = new Map(students.map(s => [s.id, s]));
  // Bashko grupet sipas sugjerimeve të pranuara
  const parent = groups.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const sg of suggestions) {
    if (!acceptedKeys.includes(sg.key)) continue;
    for (let k = 1; k < sg.groupIndexes.length; k++) parent[find(sg.groupIndexes[k])] = find(sg.groupIndexes[0]);
  }
  const finalGroups = new Map<number, number[]>();
  groups.forEach((g, i) => { const r = find(i); if (!finalGroups.has(r)) finalGroups.set(r, []); finalGroups.get(r)!.push(...g); });

  let created = 0;
  await prisma.$transaction(async tx => {
    for (const ids of finalGroups.values()) {
      const first = ids.map(id => byId.get(id)!).find(s => s.status === "ACTIVE") ?? byId.get(ids[0])!;
      const fam = await tx.family.create({ data: { organizationId: orgId, primaryContact: primaryOf(first as FamilyStudentLite) } });
      await tx.student.updateMany({ where: { id: { in: ids }, familyRefId: null }, data: { familyRefId: fam.id } });
      created++;
    }
  }, { timeout: 60000 });
  return { created, merged: acceptedKeys.length };
}

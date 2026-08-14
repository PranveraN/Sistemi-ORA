import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

const CLASS_STRUCTURE = [
  "1A","1B","2A","2B","3A","3B","4A","4B",
  "5A","5B","6A","6B","7A","7B","8A","8B","9A","9B",
];

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Save existing student → class-name mapping before we reset
  const existingStudents = await prisma.student.findMany({
    select: { id: true, class: { select: { name: true } } },
  });

  // Map: studentId → oldClassName (e.g. "2A")
  const oldMap = new Map<number, string>();
  for (const s of existingStudents) {
    if (s.class?.name) oldMap.set(s.id, s.class.name);
  }

  // 2. Detach all students from classes (safe nullable update)
  await prisma.student.updateMany({ data: { classId: null } });

  // 3. Delete ALL existing classes
  await prisma.class.deleteMany();

  // 4. Create 18 proper classes
  const newMap = new Map<string, number>(); // name → id
  for (const name of CLASS_STRUCTURE) {
    const level = `Klasa ${name[0]}`;
    const cls = await prisma.class.create({ data: { name, level } });
    newMap.set(name, cls.id);
  }

  // 5. Re-assign students to their correct new class
  let reassigned = 0;
  let unassigned  = 0;
  for (const [studentId, oldName] of oldMap) {
    const newId = newMap.get(oldName);
    if (newId) {
      await prisma.student.update({ where: { id: studentId }, data: { classId: newId } });
      reassigned++;
    } else {
      unassigned++;
    }
  }

  await logAction(session, "DELETE", "Class", null,
    `Rikrijoi strukturën e klasave (${CLASS_STRUCTURE.length} klasa), ${reassigned} nxënës u ricaktuan, ${unassigned + (existingStudents.length - oldMap.size)} mbetën pa klasë`);

  return NextResponse.json({
    classesCreated: CLASS_STRUCTURE.length,
    studentsReassigned: reassigned,
    studentsUnassigned: unassigned + (existingStudents.length - oldMap.size),
  });
}

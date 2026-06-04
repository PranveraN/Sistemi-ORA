import { prisma } from "../src/lib/prisma";

const ASSIGNMENTS = [
  { firstName: "Deja",     lastName: "Jusufi",     klasa: "6A" },
  { firstName: "Ernesa",   lastName: "Kelmendi",   klasa: "7A" },
  { firstName: "Medina",   lastName: "Kelmendi",   klasa: "7A" },
  { firstName: "Asja",     lastName: "Kroma",      klasa: "7A" },
  { firstName: "Muhamed",  lastName: "Muharremi",  klasa: "6B" },
  { firstName: "Jetmir",   lastName: "Mullarama",  klasa: "9A" },
  { firstName: "Jusuf",    lastName: "Mujku",      klasa: "7A" },
  { firstName: "Kolos",    lastName: "Murtezi",    klasa: "4A" },
  { firstName: "Marijam",  lastName: "Mujku",      klasa: "9A" },
  { firstName: "Ria",      lastName: "Musliu",     klasa: "4A" },
  { firstName: "Dua",      lastName: "Nallbani",   klasa: "4A" },
  { firstName: "Omer",     lastName: "Prekorogja", klasa: "9A" },
  { firstName: "Rejsa",    lastName: "Rama",       klasa: "6B" },
  { firstName: "Lum",      lastName: "Rrahmani",   klasa: "7A" },
  { firstName: "Ilirijana",lastName: "Sefedini",   klasa: "7A" },
  { firstName: "Lum",      lastName: "Zhilivona",  klasa: "6B" },
  { firstName: "Tara",     lastName: "Zylfiu",     klasa: "6A" },
];

// Fuzzy match: normalize string (lowercase, remove diacritics)
function norm(s: string) {
  return s.toLowerCase()
    .replace(/ë/g, "e").replace(/ç/g, "c").replace(/ë/g, "e")
    .replace(/â/g, "a").replace(/î/g, "i").replace(/ô/g, "o")
    .trim();
}

async function main() {
  // Load all classes
  const classes = await prisma.class.findMany();
  const classMap = new Map(classes.map(c => [c.name.toUpperCase(), c.id]));

  // Load all students
  const allStudents = await prisma.student.findMany({
    select: { id: true, firstName: true, lastName: true, classId: true },
  });

  let updated = 0, notFound = 0;

  for (const a of ASSIGNMENTS) {
    const classId = classMap.get(a.klasa.toUpperCase());
    if (!classId) {
      console.log(`✗ Klasa ${a.klasa} nuk ekziston!`);
      notFound++;
      continue;
    }

    // Exact match first, then fuzzy
    let student = allStudents.find(
      s => s.firstName.toLowerCase() === a.firstName.toLowerCase() &&
           s.lastName.toLowerCase()  === a.lastName.toLowerCase()
    );

    // Fuzzy fallback (handles Asja/Asija, Zhilivona/Zhilivoda, etc.)
    if (!student) {
      student = allStudents.find(
        s => norm(s.firstName) === norm(a.firstName) &&
             norm(s.lastName)  === norm(a.lastName)
      );
    }

    // Even fuzzier: same first + last starts with or contains
    if (!student) {
      student = allStudents.find(
        s => norm(s.firstName) === norm(a.firstName) &&
             (norm(s.lastName).startsWith(norm(a.lastName).slice(0, 5)) ||
              norm(a.lastName).startsWith(norm(s.lastName).slice(0, 5)))
      );
    }

    if (!student) {
      console.log(`✗ Nuk u gjet: ${a.firstName} ${a.lastName}`);
      notFound++;
      continue;
    }

    await prisma.student.update({
      where: { id: student.id },
      data: { classId },
    });

    const tag = student.firstName !== a.firstName || student.lastName !== a.lastName
      ? ` (u gjet si: ${student.firstName} ${student.lastName})`
      : "";
    console.log(`✓ ${a.firstName} ${a.lastName} → Klasa ${a.klasa}${tag}`);
    updated++;
  }

  console.log(`\n✅ U ndanë: ${updated} | Nuk u gjetën: ${notFound}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

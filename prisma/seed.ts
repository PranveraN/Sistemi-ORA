import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Duke krijuar të dhënat fillestare...");

  // Fshi të gjitha për seed të pastër
  await prisma.auditLog.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.paymentCategory.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Krijo organizatën demo
  const org = await prisma.organization.create({
    data: {
      id: 1,
      name: "Akademia Ora",
      slug: "akademia-ora",
      plan: "pro",
    },
  });

  // Super Admin (menaxhon të gjitha institucionet)
  await prisma.user.create({
    data: {
      email: "superadmin@sistemi-ora.com",
      name: "Super Admin",
      password: await bcrypt.hash("superadmin123", 10),
      role: "SUPERADMIN",
      organizationId: org.id,
    },
  });

  // Users
  const admin = await prisma.user.create({
    data: {
      email: "admin@akademiaora.al",
      name: "Admin Sistemi",
      password: await bcrypt.hash("admin123", 10),
      role: "ADMIN",
      organizationId: org.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "finance@akademiaora.al",
      name: "Financiere Ora",
      password: await bcrypt.hash("finance123", 10),
      role: "FINANCE",
      organizationId: org.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "sekretari@akademiaora.al",
      name: "Sekretaria Ora",
      password: await bcrypt.hash("secret123", 10),
      role: "SECRETARY",
      organizationId: org.id,
    },
  });

  console.log("✅ Përdoruesit u krijuan");

  // Payment Categories
  const catShkollimi = await prisma.paymentCategory.create({
    data: { name: "Shkollimi", type: "monthly", description: "Pagesa mujore e shkollimit", organizationId: org.id },
  });
  const catUshqimi = await prisma.paymentCategory.create({
    data: { name: "Ushqimi", type: "monthly", description: "Menuja ditore", organizationId: org.id },
  });
  await prisma.paymentCategory.create({
    data: { name: "Uniforma", type: "one-time", description: "Uniforma shkollore", organizationId: org.id },
  });
  await prisma.paymentCategory.create({
    data: { name: "Librat & Shkollorja", type: "annual", description: "Materialet shkollore", organizationId: org.id },
  });
  await prisma.paymentCategory.create({
    data: { name: "Aktivitete Shtesë", type: "one-time", description: "Ekskursione, ngjarje", organizationId: org.id },
  });

  console.log("✅ Kategoritë u krijuan");

  // Classes — ruaj ID-të reale
  const cls1 = await prisma.class.create({ data: { name: "1A", level: "Klasa 1", teacher: "Msc. Ardita Berisha", organizationId: org.id } });
  const cls2 = await prisma.class.create({ data: { name: "2A", level: "Klasa 2", teacher: "Msc. Besnik Hoxha", organizationId: org.id } });
  const cls3 = await prisma.class.create({ data: { name: "3A", level: "Klasa 3", teacher: "Msc. Fatmire Krasniqi", organizationId: org.id } });
  const cls4 = await prisma.class.create({ data: { name: "4A", level: "Klasa 4", teacher: "Msc. Gentian Murati", organizationId: org.id } });
  const cls5 = await prisma.class.create({ data: { name: "5A", level: "Klasa 5", teacher: "Msc. Hana Ahmeti", organizationId: org.id } });

  console.log("✅ Klasat u krijuan");

  // Students — me ID-të reale të klasave
  const studentsData = [
    { firstName: "Ardit",  lastName: "Berisha", parentName: "Agim Berisha",   personalNumber: "1001234567890", classId: cls1.id, diaryNumber: "001", parentPhone: "+383 44 111 111", address: "Rr. Nëna Tereze, Prishtinë" },
    { firstName: "Blerta", lastName: "Hoxha",   parentName: "Burim Hoxha",    personalNumber: "1001234567891", classId: cls1.id, diaryNumber: "002", parentPhone: "+383 44 222 222", address: "Rr. Skënderbeu, Prishtinë" },
    { firstName: "Çlirim", lastName: "Krasniqi",parentName: "Cen Krasniqi",   personalNumber: "1001234567892", classId: cls2.id, diaryNumber: "003", parentPhone: "+383 44 333 333", address: "Rr. Pejë, Prishtinë" },
    { firstName: "Donika", lastName: "Murati",  parentName: "Driton Murati",  personalNumber: "1001234567893", classId: cls2.id, diaryNumber: "004", parentPhone: "+383 44 444 444", address: "Rr. Fehmi Agani, Prishtinë" },
    { firstName: "Enis",   lastName: "Ahmeti",  parentName: "Enver Ahmeti",   personalNumber: "1001234567894", classId: cls3.id, diaryNumber: "005", parentPhone: "+383 44 555 555", address: "Rr. Dëshmorët, Prishtinë" },
    { firstName: "Flora",  lastName: "Bajrami", parentName: "Fatmir Bajrami", personalNumber: "1001234567895", classId: cls3.id, diaryNumber: "006", parentPhone: "+383 44 666 666", address: "Rr. Luan Haradinaj, Prishtinë" },
    { firstName: "Genci",  lastName: "Halili",  parentName: "Gazmend Halili", personalNumber: "1001234567896", classId: cls4.id, diaryNumber: "007", parentPhone: "+383 44 777 777", address: "Rr. Ramiz Sadiku, Prishtinë" },
    { firstName: "Hana",   lastName: "Osmani",  parentName: "Hamid Osmani",   personalNumber: "1001234567897", classId: cls4.id, diaryNumber: "008", parentPhone: "+383 44 888 888", address: "Rr. Ismail Qemali, Prishtinë" },
    { firstName: "Ilir",   lastName: "Zeka",    parentName: "Ilaz Zeka",      personalNumber: "1001234567898", classId: cls5.id, diaryNumber: "009", parentPhone: "+383 44 999 999", address: "Rr. Adem Jashari, Prishtinë" },
    { firstName: "Jona",   lastName: "Gashi",   parentName: "Jetmir Gashi",   personalNumber: "1001234567899", classId: cls5.id, diaryNumber: "010", parentPhone: "+383 44 000 000", address: "Rr. Xhavit Nimani, Prishtinë" },
  ];

  const students = [];
  for (const s of studentsData) {
    const student = await prisma.student.create({
      data: {
        firstName: s.firstName,
        lastName: s.lastName,
        parentName: s.parentName,
        personalNumber: s.personalNumber,
        classId: s.classId,
        diaryNumber: s.diaryNumber,
        parentPhone: s.parentPhone,
        address: s.address,
        birthDate: new Date("2015-03-15"),
        motherNumber: `MN-${s.diaryNumber}`,
        guardian: s.parentName,
        status: "ACTIVE",
        enrollDate: new Date("2024-09-01"),
        organizationId: org.id,
      },
    });
    students.push(student);
  }

  console.log("✅ Nxënësit u krijuan");

  // Payments
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  for (let i = 0; i < students.length; i++) {
    const student = students[i];

    // Pagesat e 3 muajve të fundit — shkollim
    for (let offset = -2; offset <= 0; offset++) {
      let month = currentMonth + offset;
      let year = currentYear;
      if (month <= 0) { month += 12; year -= 1; }

      const isPaid = offset < 0 || (offset === 0 && i < 7);
      const isPartial = offset === 0 && i === 7;
      const finalAmt = i === 2 ? 127.5 : i === 5 ? 130 : 150;

      await prisma.payment.create({
        data: {
          studentId: student.id,
          categoryId: catShkollimi.id,
          organizationId: org.id,
          amount: 150,
          discount: i === 2 ? 15 : 0,
          discountType: i === 2 ? "percentage" : null,
          scholarship: i === 5 ? 20 : 0,
          finalAmount: finalAmt,
          dueDate: new Date(year, month - 1, 5),
          paidDate: isPaid ? new Date(year, month - 1, 3) : null,
          paidAmount: isPaid ? finalAmt : isPartial ? 75 : 0,
          balance: isPaid ? 0 : isPartial ? finalAmt - 75 : finalAmt,
          method: isPaid ? (i % 3 === 0 ? "CASH" : i % 3 === 1 ? "BANK" : "CARD") : null,
          status: isPaid ? "PAID" : isPartial ? "PARTIAL" : offset < 0 ? "OVERDUE" : "PENDING",
          month,
          year,
          description: `Shkollimi ${month}/${year}`,
        },
      });
    }

    // Ushqimi — muaji aktual
    if (i < 6) {
      await prisma.payment.create({
        data: {
          studentId: student.id,
          categoryId: catUshqimi.id,
          organizationId: org.id,
          amount: 60,
          discount: 0,
          discountType: null,
          scholarship: 0,
          finalAmount: 60,
          dueDate: new Date(currentYear, currentMonth - 1, 5),
          paidDate: i < 4 ? new Date() : null,
          paidAmount: i < 4 ? 60 : 0,
          balance: i < 4 ? 0 : 60,
          method: i < 4 ? "CASH" : null,
          status: i < 4 ? "PAID" : "PENDING",
          month: currentMonth,
          year: currentYear,
          description: "Ushqimi mujor",
        },
      });
    }
  }

  console.log("✅ Pagesat u krijuan");

  // Invoice demo
  await prisma.invoice.create({
    data: {
      number: `FAT-${currentYear}-0001`,
      type: "INVOICE",
      studentId: students[0].id,
      organizationId: org.id,
      subtotal: 210,
      vatRate: 0,
      vatAmount: 0,
      total: 210,
      status: "PAID",
      paidDate: new Date(),
      dueDate: new Date(currentYear, currentMonth - 1, 30),
      notes: "Pagesa e shkollimit dhe ushqimit",
      items: {
        create: [
          { description: "Shkollimi mujor — Maj 2025", quantity: 1, unitPrice: 150, total: 150 },
          { description: "Ushqimi mujor — Maj 2025",   quantity: 1, unitPrice: 60,  total: 60  },
        ],
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "SEED",
      entity: "System",
      details: "Të dhënat fillestare u ngarkuan me sukses",
    },
  });

  console.log("✅ Fatura demo u krijua");
  console.log("\n🎉 Seed u kompletua!\n");
  console.log("📋 Kredencialet:");
  console.log("   Admin:      admin@akademiaora.al     / admin123");
  console.log("   Financë:    finance@akademiaora.al   / finance123");
  console.log("   Sekretari:  sekretari@akademiaora.al / secret123");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

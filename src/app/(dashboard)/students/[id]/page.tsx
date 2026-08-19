import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Header from "@/components/layout/Header";
import StudentProfile from "@/components/students/StudentProfile";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id: parseInt(id) },
    include: {
      class: true,
      payments: {
        include: { category: true },
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!student) notFound();

  // BookSale (Librat e Anglishtes) dhe UniSale (Uniforma) s'kanë relacion Prisma
  // te Student (vetëm studentId opsional), prandaj merren veç e veç dhe
  // bashkohen më poshtë — përndryshe blerjet mungonin krejtësisht nga historiku.
  const [bookSales, uniSales] = await Promise.all([
    prisma.bookSale.findMany({ where: { studentId: student.id }, orderBy: { saleDate: "desc" } }),
    prisma.uniSale.findMany({ where: { studentId: student.id }, orderBy: { saleDate: "desc" } }),
  ]);

  return (
    <>
      <Header />
      <StudentProfile student={JSON.parse(JSON.stringify({ ...student, bookSales, uniSales }))} />
    </>
  );
}

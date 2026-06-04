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

  return (
    <>
      <Header />
      <StudentProfile student={JSON.parse(JSON.stringify(student))} />
    </>
  );
}

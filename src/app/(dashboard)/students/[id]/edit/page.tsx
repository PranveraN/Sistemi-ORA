import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Header from "@/components/layout/Header";
import StudentForm from "@/components/students/StudentForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id: parseInt(id) } });
  if (!student) notFound();

  const isoDate = (d: Date | null | undefined) => d ? d.toISOString().split("T")[0] : "";

  const initial = {
    firstName: student.firstName,
    lastName: student.lastName,
    birthDate: isoDate(student.birthDate),
    personalNumber: student.personalNumber ?? "",
    classId: student.classId ? String(student.classId) : "",
    guardian: student.guardian || "",
    motherNumber: student.motherNumber || "",
    diaryNumber: student.diaryNumber || "",
    address: student.address || "",
    status: student.status,
    notes: student.notes || "",
    motherName: student.motherName || "",
    motherBirth: isoDate(student.motherBirth),
    motherProf: student.motherProf || "",
    motherPhone: student.motherPhone || "",
    motherEmail: student.motherEmail || "",
    fatherName: student.fatherName || "",
    fatherBirth: isoDate(student.fatherBirth),
    fatherProf: student.fatherProf || "",
    fatherPhone: student.fatherPhone || "",
    fatherEmail: student.fatherEmail || "",
  };

  return (
    <>
      <Header />
      <div className="p-6 max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/students/${id}`} className="text-slate-400 hover:text-slate-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="page-title">Modifiko Nxënësin</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {student.firstName} {student.lastName}
            </p>
          </div>
        </div>
        <StudentForm initial={initial} studentId={parseInt(id)} />
      </div>
    </>
  );
}

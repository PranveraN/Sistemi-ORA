import Header from "@/components/layout/Header";
import StudentForm from "@/components/students/StudentForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewStudentPage() {
  return (
    <>
      <Header />
      <div className="p-6 max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/students" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="page-title">Regjistro Nxënës të Ri</h1>
            <p className="text-sm text-slate-400 mt-0.5">Emri dhe mbiemri janë të detyrueshëm — të tjerat mund të plotësohen më vonë</p>
          </div>
        </div>
        <StudentForm />
      </div>
    </>
  );
}

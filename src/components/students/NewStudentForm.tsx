"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import StudentForm from "@/components/students/StudentForm";

interface Parent { role: "FATHER" | "MOTHER" | "GUARDIAN"; name: string; phones: string[]; emails: string[] }

// "Regjistro Nxënës" — kur hapet nga profili i familjes (?familyId=), mbiemri
// dhe prindërit paraplotësohen; pas ruajtjes, nxënësi lidhet automatikisht me
// familjen (telefon + mbiemër, shih ensureStudentFamily).
export default function NewStudentForm() {
  const sp = useSearchParams();
  const familyId = parseInt(sp.get("familyId") || "");
  const [initial, setInitial] = useState<Record<string, string> | null>(Number.isFinite(familyId) ? null : {});

  useEffect(() => {
    if (!Number.isFinite(familyId)) return;
    fetch(`/api/families/${familyId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) { setInitial({}); return; }
        const father = (d.parents as Parent[]).find(p => p.role === "FATHER");
        const mother = (d.parents as Parent[]).find(p => p.role === "MOTHER");
        setInitial({
          lastName: d.children?.[0]?.lastName ?? "",
          fatherName: father?.name ?? "", fatherPhone: father?.phones[0] ?? "", fatherEmail: father?.emails[0] ?? "",
          motherName: mother?.name ?? "", motherPhone: mother?.phones[0] ?? "", motherEmail: mother?.emails[0] ?? "",
        });
      })
      .catch(() => setInitial({}));
  }, [familyId]);

  if (!initial) return <p className="text-sm text-slate-400">Duke ngarkuar të dhënat e familjes...</p>;
  return (
    <>
      {Number.isFinite(familyId) && Object.keys(initial).length > 0 && (
        <p className="mb-4 text-sm px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300">
          Fëmijë i ri në familjen ekzistuese — mbiemri dhe prindërit janë plotësuar paraprakisht.
        </p>
      )}
      <StudentForm initial={initial} />
    </>
  );
}

"use client";

import DocumentDropzone from "../DocumentDropzone";
import { DOC_TYPES, isDocRequired } from "@/lib/enrollmentDocs";
import type { UploadedDoc } from "../types";

interface Props {
  applicationId: number | null;
  resumeToken: string | null;
  gradeNumber: number | null;
  documents: UploadedDoc[];
  setDocuments: (docs: UploadedDoc[]) => void;
  onExpired: () => void;
}

export default function DocumentsStep({ applicationId, resumeToken, gradeNumber, documents, setDocuments, onExpired }: Props) {

  if (!applicationId || !resumeToken) {
    return <p className="text-sm text-slate-400">Plotëso hapat e mëparshëm së pari.</p>;
  }

  function updateDocsOf(docType: string, next: UploadedDoc[]) {
    setDocuments([...documents.filter(d => d.docType !== docType), ...next]);
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-400">
        Bashkëngjit dokumentet e kërkuara më poshtë. Mund t'i zëvendësosh ose fshish para se ta dorëzosh aplikimin.
      </p>
      {DOC_TYPES.map(dt => (
        <DocumentDropzone
          key={dt.type}
          applicationId={applicationId}
          resumeToken={resumeToken}
          docType={dt.type}
          label={dt.label}
          required={isDocRequired(dt.type, gradeNumber)}
          multiple={dt.multiple}
          docs={documents.filter(d => d.docType === dt.type)}
          onChanged={next => updateDocsOf(dt.type, next)}
          onExpired={onExpired}
        />
      ))}
    </div>
  );
}

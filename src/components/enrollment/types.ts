export interface ApplicationFormState {
  schoolYear: string;
  desiredGrade: string;
  previousSchool: string;
  lastCompletedGrade: string;
  desiredStartDate: string;
  applicationReason: string;

  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  personalNumber: string;
  citizenship: string;
  birthCountry: string;
  originType: "" | "KOSOVE" | "DIASPORA";
  originCountry: string;

  motherName: string;
  motherBirth: string;
  motherProf: string;
  motherPhone: string;
  motherEmail: string;
  motherAddress: string;

  fatherName: string;
  fatherBirth: string;
  fatherProf: string;
  fatherPhone: string;
  fatherEmail: string;
  fatherAddress: string;

  primaryContact: "" | "MOTHER" | "FATHER" | "OTHER";
  guardianOtherName: string;
  guardianOtherRelation: string;
  guardianOtherPhone: string;
  guardianOtherEmail: string;

  address: string;
  city: string;
  country: string;

  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;

  additionalInfo: string;
  consentDataAccurate: boolean;
  waitlisted: boolean;
}

export const EMPTY_FORM: ApplicationFormState = {
  schoolYear: "", desiredGrade: "", previousSchool: "", lastCompletedGrade: "", desiredStartDate: "", applicationReason: "",
  firstName: "", lastName: "", birthDate: "", gender: "", personalNumber: "", citizenship: "", birthCountry: "",
  originType: "", originCountry: "",
  motherName: "", motherBirth: "", motherProf: "", motherPhone: "", motherEmail: "", motherAddress: "",
  fatherName: "", fatherBirth: "", fatherProf: "", fatherPhone: "", fatherEmail: "", fatherAddress: "",
  primaryContact: "", guardianOtherName: "", guardianOtherRelation: "", guardianOtherPhone: "", guardianOtherEmail: "",
  address: "", city: "", country: "",
  emergencyContactName: "", emergencyContactRelation: "", emergencyContactPhone: "",
  additionalInfo: "", consentDataAccurate: false, waitlisted: false,
};

export type FieldSetter = <K extends keyof ApplicationFormState>(field: K, value: ApplicationFormState[K]) => void;

export interface ConfigGrade {
  grade: number;
  label: string;
  isFull: boolean;
}

export interface ConfigCustomField {
  id: number;
  label: string;
  type: "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "CHECKBOX";
  required: boolean;
  options: string[] | null;
}

export interface EnrollmentConfig {
  enrollmentOpen: boolean;
  schoolYears: { value: string; label: string }[];
  defaultSchoolYear: string;
  grades: ConfigGrade[];
  existingFieldConfig: Record<string, { visible: boolean; required: boolean }>;
  customFields: ConfigCustomField[];
}

// A duhet të shfaqet/kërkohet një fushë "e thjeshtë" ekzistuese — parazgjedhje
// e sigurt (shfaqe, jo e domosdoshme) kur config-u ende s'është ngarkuar.
export function fieldVisible(config: EnrollmentConfig | null, key: string): boolean {
  return config?.existingFieldConfig[key]?.visible ?? true;
}
export function fieldRequired(config: EnrollmentConfig | null, key: string): boolean {
  return config?.existingFieldConfig[key]?.required ?? false;
}

export interface UploadedDoc {
  id: number;
  docType: string;
  originalName: string;
  contentType: string;
  size: number;
}

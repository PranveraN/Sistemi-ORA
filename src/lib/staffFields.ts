export interface StaffFieldsInput {
  emri?: string; telefoni?: string | null; lenda?: string | null; nrPersonal?: string | null;
  nrLlogarise?: string | null; banka?: string | null; totalBruto?: number | string | null;
  kontrata?: string | null; llojiKontrates?: string | null; cmimOres?: number | string | null;
  oreMuaj?: number | string | null; adresa?: string | null; kodi?: string | null; tipi?: string | null;
  status?: string;
  dataLindjes?: string | null; vendlindja?: string | null; gjinia?: string | null; shtetesia?: string | null;
  email?: string | null; dataFillimit?: string | null; orari?: string | null; niveliShkollimit?: string | null;
  profesioni?: string | null; pozita?: string | null;
}

/** Ndërton objektin `data` për Staff.create/update — përdoret nga POST/PUT
 * dhe nga importi i bashkuar (merge-import), që fushat e reja (shtuar për
 * template-in Excel) të mos duplikohen nëpër skedarë. */
export function buildStaffData(body: StaffFieldsInput) {
  return {
    emri:        body.emri        || "",
    telefoni:    body.telefoni    || null,
    lenda:       body.lenda       || null,
    nrPersonal:  body.nrPersonal  || null,
    nrLlogarise: body.nrLlogarise || null,
    banka:       body.banka       || null,
    totalBruto:  body.totalBruto  != null && body.totalBruto !== "" ? parseFloat(String(body.totalBruto)) : null,
    kontrata:        body.kontrata        || null,
    llojiKontrates:  body.llojiKontrates  || null,
    cmimOres:        body.cmimOres  != null && body.cmimOres !== "" ? parseFloat(String(body.cmimOres)) : null,
    oreMuaj:         body.oreMuaj   != null && body.oreMuaj  !== "" ? parseInt(String(body.oreMuaj))   : null,
    adresa:          body.adresa          ?? null,
    kodi:            body.kodi            || null,
    tipi:        body.tipi        || null,
    status:      body.status      || "ACTIVE",
    dataLindjes:      body.dataLindjes      ? new Date(body.dataLindjes)      : null,
    vendlindja:       body.vendlindja       || null,
    gjinia:           body.gjinia           || null,
    shtetesia:        body.shtetesia        || null,
    email:            body.email            || null,
    dataFillimit:     body.dataFillimit     ? new Date(body.dataFillimit)     : null,
    orari:            body.orari            || null,
    niveliShkollimit: body.niveliShkollimit || null,
    profesioni:       body.profesioni       || null,
    pozita:           body.pozita           || null,
  };
}

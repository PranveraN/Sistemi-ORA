// Çfarë sheh mësuesja nga kërkesa e vet: vetëm statusin — jo kujt iu porosit,
// si (SMS/email), numrin e porosisë apo kontaktet e furnitorit. Hiqet në server.

type AnyRecord = Record<string, unknown>;

const HIDDEN_REQUEST_FIELDS = ["sentAt", "sentToEmail", "sentSmsAt", "sentToPhone"];

export function toTeacherView<T>(request: T): T {
  if (!request || typeof request !== "object") return request;
  const r = { ...(request as AnyRecord) };
  for (const k of HIDDEN_REQUEST_FIELDS) delete r[k];
  if (Array.isArray(r.items)) {
    r.items = (r.items as AnyRecord[]).map(it => {
      const { orderLinks: _hidden, ...rest } = it; // eslint-disable-line @typescript-eslint/no-unused-vars
      return rest;
    });
  }
  // Shënimet e historikut mund të përmbajnë furnitorin/numrin e porosisë
  if (Array.isArray(r.statusHistory)) {
    r.statusHistory = (r.statusHistory as AnyRecord[]).map(h => ({ ...h, note: null }));
  }
  return r as T;
}

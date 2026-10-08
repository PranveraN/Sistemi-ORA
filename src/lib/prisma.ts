import { PrismaClient } from "@prisma/client";
import { AUDITED_MODELS } from "@/lib/audit/tables";
import {
  auditStorage, resolveActor, contextParams, SET_CONTEXT_SQL, CLEAR_CONTEXT_SQL,
  type AuditActor, type AuditStore, type AuditTx,
} from "@/lib/audit/context";
import { recordClosedDayChanges, maxAuditLogId } from "@/lib/audit/closedDay";

type TxDb = Parameters<typeof recordClosedDayChanges>[0];

// ── Shtresa qendrore e auditimit ───────────────────────────────────────────
// Çdo shkrim (create/update/upsert/delete…) në një tabelë financiare kalon nga
// këtu: para ndryshimit vendoset FinAuditContext (përdoruesi, IP, arsyeja)
// BRENDA të njëjtit transaksion, dhe hiqet në fund të tij — triggers e SQLite
// (src/lib/audit/triggers.ts) e lexojnë kur shkruajnë FinAuditLog.
//   • shkrim i vetëm       → transaksion i vogël: konteksti, shkrimi, kontrolli i arkave, pastrimi
//   • $transaction(async)  → konteksti vendoset te tx para shkrimit, hiqet në fund
//   • $transaction([...])  → konteksti shtohet në fillim/fund të listës
// Edhe nëse dikush e anashkalon këtë shtresë (SQL i papërpunuar), triggers e
// regjistrojnë ndryshimin gjithsesi — vetëm pa përdorues (source="DB").

const WRITE_OPS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert", "delete", "deleteMany"]);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
type Args = Record<string, unknown>;
type AnyDelegate = Record<string, (args: unknown) => Promise<unknown>>;

/** Pagesat e reja marrin `createdById` nga përdoruesi i kyçur (nëse s'është dhënë). */
function stampCreatedBy(model: string, operation: string, args: Args, userId: number | null): Args {
  if (model !== "Payment" || !userId) return args;
  const stamp = (d: unknown) => (d && typeof d === "object" && !Array.isArray(d) && (d as Args).createdById == null ? { ...(d as Args), createdById: userId } : d);
  if (operation === "create") return { ...args, data: stamp(args.data) };
  if (operation === "createMany" || operation === "createManyAndReturn") {
    return { ...args, data: Array.isArray(args.data) ? args.data.map(stamp) : stamp(args.data) };
  }
  if (operation === "upsert") return { ...args, create: stamp(args.create) };
  return args;
}

export function createPrismaClient(url?: string): PrismaClient {
  const base = new PrismaClient({
    log: ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
  // Middleware-i (Edge) s'shkruan kurrë në databazë — mbetet klienti i thjeshtë
  if (typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime === "string") return base;

  const ext = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !WRITE_OPS.has(operation) || !AUDITED_MODELS.has(model)) return query(args);
          const store = auditStorage.getStore();
          const actor = await resolveActor();
          const a = stampCreatedBy(model, operation, args as Args, actor.userId);
          if (store?.batch) return query(a as typeof args);

          // Pas shkrimit (brenda të njëjtit transaksion) shënohet gjetje nëse ndryshimi prek
          // paratë e një arke në një ditë tashmë të numëruar — s'bllokohet asgjë
          // (src/lib/audit/closedDay.ts). Për çdo tabelë të audituar, jo vetëm ato të
          // arkës: p.sh. një shitje uniforme krijon pagesën e saj si shkrim i brendshëm.
          if (store?.tx && store.txState) {
            const tx = store.tx as unknown as TxDb;
            await store.tx.$executeRawUnsafe(SET_CONTEXT_SQL, ...contextParams(actor));
            store.txState.ctxSet = true;
            const before = await maxAuditLogId(tx);
            const result = await query(a as typeof args);
            await recordClosedDayChanges(tx, before, actor);
            return result;
          }
          return base.$transaction(async tx => {
            await tx.$executeRawUnsafe(SET_CONTEXT_SQL, ...contextParams(actor));
            const before = await maxAuditLogId(tx);
            const result = await (tx as unknown as Record<string, AnyDelegate>)[lowerFirst(model)][operation](a);
            await recordClosedDayChanges(tx, before, actor);
            await tx.$executeRawUnsafe(CLEAR_CONTEXT_SQL);
            return result;
          });
        },
      },
    },
  });

  const origTx = ext.$transaction.bind(ext) as (arg: unknown, opts?: unknown) => Promise<unknown>;

  // Klienti i transaksionit: çdo thirrje modeli ekzekutohet brenda kontekstit
  // të këtij transaksioni (që shtresa sipër ta dijë se është brenda tx-it).
  function wrapTx(tx: object, store: AuditStore): object {
    return new Proxy(tx, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof prop !== "string" || prop.startsWith("$") || !value || typeof value !== "object") return value;
        return new Proxy(value as object, {
          get(dt, op, dr) {
            const fn = Reflect.get(dt, op, dr);
            if (typeof fn !== "function") return fn;
            return (...fnArgs: unknown[]) => auditStorage.run(store, () => {
              const p = (fn as (...x: unknown[]) => unknown).apply(dt, fnArgs);
              return p && typeof (p as Promise<unknown>).then === "function" ? (p as Promise<unknown>).then(x => x) : p;
            });
          },
        });
      },
    });
  }

  async function auditedTransaction(arg: unknown, opts?: unknown): Promise<unknown> {
    const parent = auditStorage.getStore();
    if (parent?.tx || parent?.batch) return origTx(arg, opts);
    const actor: AuditActor = await resolveActor();
    if (Array.isArray(arg)) {
      const store: AuditStore = { ...parent, actor, batch: true };
      return auditStorage.run(store, async () => {
        const res = (await origTx([
          ext.$executeRawUnsafe(SET_CONTEXT_SQL, ...contextParams(actor)),
          ...arg,
          ext.$executeRawUnsafe(CLEAR_CONTEXT_SQL),
        ], opts)) as unknown[];
        return res.slice(1, -1);
      });
    }
    const fn = arg as (tx: unknown) => Promise<unknown>;
    return origTx(async (tx: AuditTx & object) => {
      const store: AuditStore = { ...parent, actor, tx, txState: { ctxSet: false } };
      const result = await fn(wrapTx(tx, store));
      if (store.txState!.ctxSet) await tx.$executeRawUnsafe(CLEAR_CONTEXT_SQL);
      return result;
    }, opts);
  }

  return new Proxy(ext, {
    get(target, prop, receiver) {
      if (prop === "$transaction") return auditedTransaction;
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

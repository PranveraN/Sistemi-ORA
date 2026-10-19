// Llogaritja e stokut të uniformave sipas numrit — funksione të pastra (pa databazë),
// që të testohen veç. Stoku = hyrjet − copët e shitura pas nisjes së stokut të ri.

/** Numrat që përdoren te forma e shitjes — lista e parazgjedhur për çdo produkt. */
export const DEFAULT_SIZES = ["1", "2", "3", "4", "5", "6", "7", "XS", "S", "M", "L", "XL", "2XL"];

export type StockStatus = "OK" | "NE_PRAG" | "NEN_PRAG" | "MBARUAR" | "PA_HYRJE";

export const STATUS_LABELS: Record<StockStatus, string> = {
  OK: "Në rregull",
  NE_PRAG: "Në prag",
  NEN_PRAG: "Nën prag",
  MBARUAR: "Mbaruar",
  PA_HYRJE: "Pa hyrje",
};

export interface SizeRow {
  size: string;
  hyre: number;
  shitur: number;
  stok: number;
  prag: number;
  status: StockStatus;
}

export interface ProductRow {
  productId: number;
  name: string;
  buyPrice: number;
  hyre: number;
  shitur: number;
  stok: number;
  lowCount: number; // numra që kërkojnë vëmendje (në/nën prag ose mbaruar)
  sizes: SizeRow[];
}

/**
 * Statusi i një numri. Një numër që s'ka pasur kurrë hyrje, shitje apo prag
 * mbetet "Pa hyrje" dhe nuk ngre alarm — përndryshe, në nisje, çdo numër do
 * të dilte "Mbaruar".
 */
export function sizeStatus(hyre: number, shitur: number, prag: number): StockStatus {
  const stok = hyre - shitur;
  if (hyre === 0 && shitur === 0 && prag === 0) return "PA_HYRJE";
  if (stok <= 0) return "MBARUAR";
  if (stok < prag) return "NEN_PRAG";
  if (stok === prag) return "NE_PRAG";
  return "OK";
}

/** Njoftim kur stoku bie në ose nën prag (përfshirë mbarimin). */
export const needsAttention = (s: StockStatus) => s === "NE_PRAG" || s === "NEN_PRAG" || s === "MBARUAR";

const sizeOrder = (list: string[]) => (a: string, b: string) => {
  const ia = list.indexOf(a), ib = list.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  return a.localeCompare(b, "sq", { numeric: true });
};

export function buildStock(input: {
  products: { id: number; name: string; buyPrice: number }[];
  productSizes: { productId: number; size: string; sortOrder: number }[];
  entries: { productId: number; size: string; quantity: number }[];
  sold: { productId: number; size: string | null; quantity: number }[];
  settings: { productId: number; size: string; minThreshold: number }[];
}): ProductRow[] {
  const key = (p: number, s: string) => `${p}|${s}`;
  const hyre = new Map<string, number>();
  const shitur = new Map<string, number>();
  const prag = new Map<string, number>();
  for (const e of input.entries) hyre.set(key(e.productId, e.size), (hyre.get(key(e.productId, e.size)) ?? 0) + e.quantity);
  for (const s of input.sold) {
    const size = (s.size ?? "").trim() || "—";
    shitur.set(key(s.productId, size), (shitur.get(key(s.productId, size)) ?? 0) + s.quantity);
  }
  for (const s of input.settings) prag.set(key(s.productId, s.size), s.minThreshold);

  return input.products.map(p => {
    const own = input.productSizes.filter(x => x.productId === p.id).sort((a, b) => a.sortOrder - b.sortOrder).map(x => x.size);
    const list = own.length ? own : DEFAULT_SIZES;
    // Numrat jashtë listës që kanë lëvizje (hyrje/shitje) shfaqen gjithsesi.
    const extra = new Set<string>();
    for (const m of [hyre, shitur]) for (const k of m.keys()) {
      const [pid, size] = [Number(k.split("|")[0]), k.slice(k.indexOf("|") + 1)];
      if (pid === p.id && !list.includes(size)) extra.add(size);
    }
    const all = [...list, ...[...extra].sort(sizeOrder(DEFAULT_SIZES))];
    const sizes: SizeRow[] = all.map(size => {
      const h = hyre.get(key(p.id, size)) ?? 0;
      const sh = shitur.get(key(p.id, size)) ?? 0;
      const pr = prag.get(key(p.id, size)) ?? 0;
      return { size, hyre: h, shitur: sh, stok: h - sh, prag: pr, status: sizeStatus(h, sh, pr) };
    });
    return {
      productId: p.id,
      name: p.name,
      buyPrice: p.buyPrice,
      hyre: sizes.reduce((s, x) => s + x.hyre, 0),
      shitur: sizes.reduce((s, x) => s + x.shitur, 0),
      stok: sizes.reduce((s, x) => s + x.stok, 0),
      lowCount: sizes.filter(x => needsAttention(x.status)).length,
      sizes,
    };
  });
}

/** Lista e numrave për njoftim: "Trenerka e poshtme nr. 12 (2 copë)". */
export function lowStockList(rows: ProductRow[]) {
  return rows.flatMap(p => p.sizes.filter(s => needsAttention(s.status)).map(s => ({
    productId: p.productId, size: s.size, stock: s.stok, status: s.status,
    name: `${p.name} nr. ${s.size}`,
  })));
}

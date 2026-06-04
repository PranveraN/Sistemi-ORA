import { PrismaClient } from './node_modules/@prisma/client/index.js';
const prisma = new PrismaClient();
try {
  const r = await prisma.$queryRawUnsafe('PRAGMA table_info(UniSaleItem)');
  const cols = r.map(c => ({ cid: Number(c.cid), name: c.name, type: c.type }));
  console.log(cols.map(c => `${c.cid}: ${c.name} (${c.type})`).join('\n'));
} catch(e) {
  console.error('ERROR:', e.message);
} finally {
  await prisma.$disconnect();
}

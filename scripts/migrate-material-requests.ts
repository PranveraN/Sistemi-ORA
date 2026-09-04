// Konverton çdo `MaterialRequest` ekzistuese (strukturë e vjetër, e sheshtë:
// item/quantity/unit/subjectOrClass) në strukturën e re parent+items:
// krijon SAKTËSISHT një MaterialRequestItem + histori statusesh sintetike.
//
// I sigurt të ekzekutohet disa herë: nëse një kërkesë tashmë ka >=1 item,
// hidhet poshtë (skip), s'krijohet dublikatë.
//
// Verifikon në fund që çdo MaterialRequest ka saktësisht 1 item para se të
// raportojë sukses. Nuk fshin/prek fushat e vjetra (item/quantity/unit/
// subjectOrClass) — ato hiqen vetëm në një hap të mëvonshëm, DESTRUKTIV, pasi
// të jetë verifikuar migrimi dhe të jetë përditësuar kodi konsumues.
//
// Përdorim:
//   npx tsx scripts/migrate-material-requests.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Statuset e vjetra (PENDING/APPROVED/REJECTED) -> statuset e reja të kërkesës + artikullit
const STATUS_MAP: Record<string, { requestStatus: string; itemStatus: string }> = {
  PENDING:  { requestStatus: "SUBMITTED", itemStatus: "PENDING" },
  APPROVED: { requestStatus: "APPROVED",  itemStatus: "APPROVED" },
  REJECTED: { requestStatus: "REJECTED",  itemStatus: "REJECTED" },
};

async function main() {
  const totalRequests = await prisma.materialRequest.count();
  console.log(`Gjetur ${totalRequests} kërkesa ekzistuese.`);

  if (totalRequests === 0) {
    console.log("Asgjë për të migruar — bazë bosh. Skripti përfundoi si no-op.");
    return;
  }

  const requests = await prisma.materialRequest.findMany({
    include: { items: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const r of requests) {
    if (r.items.length > 0) {
      skipped++;
      continue;
    }
    if (!r.item) {
      // Rresht pa items[] dhe pa fushën e vjetër `item` — anomali (s'duhet të
      // ndodhë: çdo kërkesë e re krijohet direkt me items[]). E kalojmë pa e
      // prekur, në vend që të krijojmë një artikull bosh.
      console.warn(`⚠️  Kërkesa #${r.id} s'ka as items[] as fushën e vjetër "item" — kaluar.`);
      skipped++;
      continue;
    }

    const legacyStatus = r.status;
    const mapped = STATUS_MAP[legacyStatus] ?? { requestStatus: "SUBMITTED", itemStatus: "PENDING" };

    await prisma.$transaction(async (tx) => {
      await tx.materialRequestItem.create({
        data: {
          requestId: r.id,
          isCustom: true,
          customItemName: r.item,
          quantity: r.quantity ?? 1,
          unit: r.unit ?? "copë",
          status: mapped.itemStatus,
          approvedQuantity: mapped.itemStatus === "APPROVED" ? (r.quantity ?? 1) : null,
        },
      });

      await tx.materialRequestStatusHistory.create({
        data: {
          requestId: r.id,
          fromStatus: null,
          toStatus: "SUBMITTED",
          changedById: r.teacherId,
          note: "Migruar automatikisht nga struktura e vjetër",
          createdAt: r.createdAt,
        },
      });

      if (legacyStatus !== "PENDING") {
        await tx.materialRequestStatusHistory.create({
          data: {
            requestId: r.id,
            fromStatus: "SUBMITTED",
            toStatus: mapped.requestStatus,
            changedById: r.reviewedById ?? r.teacherId,
            note: r.reviewNote ?? "Migruar automatikisht nga struktura e vjetër",
            createdAt: r.reviewedAt ?? r.createdAt,
          },
        });
      }

      await tx.materialRequest.update({
        where: { id: r.id },
        data: {
          status: mapped.requestStatus,
          submittedAt: r.submittedAt ?? r.createdAt,
        },
      });
    });

    migrated++;
  }

  console.log(`✅ Migruar: ${migrated}. Kaluar (kishin tashmë items): ${skipped}.`);

  // Verifikim: çdo kërkesë duhet të ketë tani saktësisht >=1 item
  const withoutItems = await prisma.materialRequest.findMany({
    where: { items: { none: {} } },
    select: { id: true },
  });
  if (withoutItems.length > 0) {
    throw new Error(
      `❌ VERIFIKIMI DËSHTOI: ${withoutItems.length} kërkesa ende s'kanë asnjë item: ${withoutItems.map(r => r.id).join(", ")}`
    );
  }
  console.log("✅ Verifikimi kaloi: çdo MaterialRequest ka të paktën 1 MaterialRequestItem.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

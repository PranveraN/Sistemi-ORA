import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const cat = await prisma.paymentCategory.update({
    where: { id: parseInt(id) },
    data: {
      ...(body.name        !== undefined && { name:          body.name }),
      ...(body.description !== undefined && { description:   body.description || null }),
      ...(body.type        !== undefined && { type:          body.type }),
      ...(body.defaultAmount !== undefined && { defaultAmount: parseFloat(body.defaultAmount) }),
    },
  });

  return NextResponse.json(cat);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.paymentCategory.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (e) {
    // P2003 = kufizim çelësi të huaj (ka ende pagesa/të dhëna të lidhura) —
    // kategoria s'fshihet KURRË vetvetiu bashkë me pagesat, edhe pse dialogu
    // i vjetër i konfirmimit e sugjeronte gabimisht atë.
    const code = (e as { code?: string }).code;
    if (code === "P2003") {
      return NextResponse.json({ error: "Ka ende të dhëna (pagesa/çmime) të lidhura me këtë kategori — s'mund të fshihet." }, { status: 409 });
    }
    throw e;
  }
}

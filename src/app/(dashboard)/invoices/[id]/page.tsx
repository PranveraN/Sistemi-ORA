import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Header from "@/components/layout/Header";
import InvoiceView from "@/components/invoices/InvoiceView";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(id) },
    include: {
      student: { include: { class: true } },
      items: true,
    },
  });

  if (!invoice) notFound();

  return (
    <>
      <Header />
      <InvoiceView invoice={JSON.parse(JSON.stringify(invoice))} />
    </>
  );
}

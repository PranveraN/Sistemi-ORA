import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Header from "@/components/layout/Header";
import InvoiceEditForm from "@/components/invoices/InvoiceEditForm";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(id) },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, parentName: true } },
      items: true,
    },
  });

  if (!invoice) notFound();

  return (
    <>
      <Header title={`Modifiko Faturën ${invoice.number}`} />
      <InvoiceEditForm invoice={JSON.parse(JSON.stringify(invoice))} />
    </>
  );
}

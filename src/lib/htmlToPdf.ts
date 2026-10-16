// Kthen një faqe HTML të printimit (vërtetime, kontrata…) në PDF A4 në shfletues —
// e njëjta pamje si te "Printo". Përdoret për "Dërgo me email" (bashkëngjitje).
// Vetëm në klient (html2canvas + jspdf).

export async function htmlPageToPdfBase64(html: string, pageSelector = ".page"): Promise<string> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  try {
    const d = iframe.contentDocument!;
    d.open();
    d.write(html.replace(/<script[\s\S]*?<\/script>/gi, "")); // pa window.print()
    d.close();
    await new Promise(r => setTimeout(r, 60));
    await Promise.all(Array.from(d.images).map(img => (img.complete ? null : new Promise(res => { img.onload = img.onerror = () => res(null); }))));
    const page = (d.querySelector(pageSelector) as HTMLElement | null) ?? d.body;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(page, { scale: 2, backgroundColor: "#ffffff", useCORS: true, windowWidth: 794 });
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const w = 210, h = Math.min(297, (canvas.height * w) / canvas.width);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, w, h);
    return (pdf.output("datauristring") as string).split(",")[1];
  } finally {
    iframe.remove();
  }
}

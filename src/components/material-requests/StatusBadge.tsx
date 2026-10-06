import { requestStatusUi, orderStatusUi } from "@/lib/materialStatusUi";

// Badge-i i vetëm i statuseve të Materialeve (administrata, paneli i mësueses).
export default function StatusBadge({ status, kind = "request", extra, className = "" }: {
  status: string;
  kind?: "request" | "order";
  extra?: string;
  className?: string;
}) {
  const ui = kind === "order" ? orderStatusUi(status) : requestStatusUi(status);
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${ui.badge} ${className}`}>
      {ui.label}{extra ? ` · ${extra}` : ""}
    </span>
  );
}

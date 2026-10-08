import { post } from "@/lib/api";

/** Files an on-screen crash with the existing bug-report intake (POST /api/support/report). Only ever called from a button tap. */
export function reportClientError(where: string, e: { name?: string; message?: string; stack?: string; digest?: string }): Promise<unknown> {
  const steps = `${where} showed the error screen.\n${e.name ?? "Error"}: ${e.message ?? ""}${e.digest ? `\ndigest ${e.digest}` : ""}\n${(e.stack ?? "").split("\n").slice(0, 6).join("\n")}`.slice(0, 4900);
  return post("/api/support/report", { page: location.pathname + location.search, steps, severity: "high", device: navigator.userAgent.slice(0, 480) });
}

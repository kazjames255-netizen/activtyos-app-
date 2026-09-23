import { get, post, put } from "@/lib/api";

// Tools tab — server/src/routes/hub/toolsApi.ts. `qs` is the hub's "?tenantId=…" (a parent's carries &childId=…).
const join = (qs: string, extra: string) => `${qs}${qs.includes("?") ? "&" : "?"}${extra}`;

/** Count an open / a click on an unbuilt tool. Fire-and-forget: never blocks or breaks the UI. */
export function logToolEvent(qs: string, toolId: string, kind: "open" | "comingSoonClick" | "buildingClick") {
  post(`/api/learning-hub/tools/events${qs}`, { toolId, kind }).catch(() => { /* usage counts are a nicety */ });
}
export const loadToolState = (qs: string, toolId: string, contextType = "free", contextId = "-") =>
  get<{ state: unknown; schemaVersion?: number; updatedAt?: string | null }>(`/api/learning-hub/tools/state${join(qs, `toolId=${encodeURIComponent(toolId)}&contextType=${contextType}&contextId=${encodeURIComponent(contextId)}`)}`);
export const saveToolState = (qs: string, toolId: string, state: unknown, schemaVersion = 1, contextType = "free", contextId = "-") =>
  put<{ ok: true }>(`/api/learning-hub/tools/state${qs}`, { toolId, contextType, contextId, schemaVersion, state });

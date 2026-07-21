// Blocks-builder API client — periods, passes and block bundles now live on
// the server (see server/src/routes/blockBundles.ts). The server also resolves
// pricing, so `resolved` is the source of truth for prices; the UI's local
// calculator is only a live preview while editing.
import { get, post, put, del } from "@/lib/api";

export interface ApiPeriod {
  id: string;
  title: string;
  start: string;
  finish: string;
}
export interface ApiPass {
  id: string;
  name: string;
  days: number;
  /** Optional blurb shown to customers under the pass name. */
  details?: string;
}
export interface ResolvedPricing {
  passes: { id: string; name: string; days: number; price: number; details?: string }[];
  timings: Record<string, number>;
  perDay: number;
}
export interface ApiBundle {
  id: string;
  name: string;
  periodIds: string[];
  passIds: string[];
  listingIds: string[];
  order: number;
  archived: boolean;
  priced: boolean;
  masterPrice: number | null;
  calcOn: boolean;
  passFlat: Record<string, number>;
  passMode: Record<string, "flat">;
  periodPrice: Record<string, number>;
  resolved: ResolvedPricing;
}

/** The writable half of a bundle — what POST/PUT accept. */
export type BundleInput = Pick<
  ApiBundle,
  "name" | "periodIds" | "passIds" | "archived" | "priced" | "masterPrice" | "calcOn" | "passFlat" | "passMode" | "periodPrice"
>;

export const listPeriods = () => get<ApiPeriod[]>("/api/periods");
export const createPeriod = (b: Omit<ApiPeriod, "id">) => post<ApiPeriod>("/api/periods", b);
export const updatePeriod = (id: string, b: Omit<ApiPeriod, "id">) => put<ApiPeriod>(`/api/periods/${id}`, b);
export const deletePeriod = (id: string) => del<{ ok: true }>(`/api/periods/${id}`);

export const listPasses = () => get<ApiPass[]>("/api/passes");
export const createPass = (b: Omit<ApiPass, "id">) => post<ApiPass>("/api/passes", b);
export const updatePass = (id: string, b: Omit<ApiPass, "id">) => put<ApiPass>(`/api/passes/${id}`, b);
export const deletePass = (id: string) => del<{ ok: true }>(`/api/passes/${id}`);

export const listBundles = () => get<ApiBundle[]>("/api/block-bundles");
export const createBundle = (b: BundleInput) => post<ApiBundle>("/api/block-bundles", b);
export const updateBundle = (id: string, b: BundleInput) => put<ApiBundle>(`/api/block-bundles/${id}`, b);
export const deleteBundle = (id: string) => del<{ ok: true }>(`/api/block-bundles/${id}`);
export const duplicateBundle = (id: string) => post<ApiBundle>(`/api/block-bundles/${id}/duplicate`, {});
export const archiveBundle = (id: string, archived: boolean) => post<ApiBundle>(`/api/block-bundles/${id}/archive`, { archived });
export const reorderBundles = (orderedIds: string[]) => post<{ ok: true }>("/api/block-bundles/reorder", { orderedIds });
/** Associate the bundle with listings and snapshot resolved prices onto them. */
export const sendBundleToListings = (id: string, listingIds: string[]) => put<ApiBundle>(`/api/block-bundles/${id}/listings`, { listingIds });

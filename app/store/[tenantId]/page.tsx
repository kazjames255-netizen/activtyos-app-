import { StorePage } from "@/features/storefront/StorePage";

// A provider's whole public storefront — every live listing, bookable.
// This is what the embed widget's data-store mode shows inside their
// website, and what their subdomain will point at once domains exist.
export default async function Store(props: PageProps<"/store/[tenantId]">) {
  const { tenantId } = await props.params;
  return <StorePage tenantId={tenantId} />;
}

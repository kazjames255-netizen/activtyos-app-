import { createElement } from "react";
import { notFound } from "next/navigation";
import { PORTALS, findNavItem, type PortalKey } from "@/lib/nav/config";
import { getRegisteredView } from "@/lib/view-registry";

export default async function ViewPage(props: PageProps<"/[portal]/[view]">) {
  const { portal, view } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;

  const navItem = findNavItem(portalKey, view);
  if (!navItem) notFound();
  // The prototype's mock sign-in views ("Log out" targets) are replaced by
  // real Firebase sign-out in the sidebar — never render them.
  if (view === "auth") notFound();

  // Every nav slug maps to a real component — the legacy prototype iframe
  // fallback is gone (a slug with no component doesn't go in the nav).
  const registeredView = getRegisteredView(portalKey, view);
  if (!registeredView) notFound();
  return <div className="p-5">{createElement(registeredView)}</div>;
}

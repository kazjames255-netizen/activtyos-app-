import { createElement } from "react";
import { notFound } from "next/navigation";
import { PORTALS, findNavItem, type PortalKey } from "@/lib/nav/config";
import { getRegisteredView } from "@/lib/view-registry";
import { LegacyViewFrame } from "@/components/shell/LegacyViewFrame";

export default async function ViewPage(props: PageProps<"/[portal]/[view]">) {
  const { portal, view } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;

  const navItem = findNavItem(portalKey, view);
  if (!navItem) notFound();

  const registeredView = getRegisteredView(portalKey, view);
  if (registeredView) {
    return <div className="p-5">{createElement(registeredView)}</div>;
  }

  return <LegacyViewFrame portal={portalKey} legacyView={navItem.legacyView} />;
}

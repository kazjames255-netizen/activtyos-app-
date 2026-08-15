import { notFound, redirect } from "next/navigation";
import { PORTALS, getDefaultView, type PortalKey } from "@/lib/nav/config";

// Bare portal URLs (/platform, /company, …) land on the portal's first
// nav view. Never cache this stub — a cached redirect response can leave a
// tab stranded on an empty shell after a dev-server rebuild.
export const dynamic = "force-dynamic";

export default async function PortalIndex(props: PageProps<"/[portal]">) {
  const { portal } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  redirect(`/${portal}/${getDefaultView(portal as PortalKey)}`);
}

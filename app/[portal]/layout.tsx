import { notFound } from "next/navigation";
import { PORTALS, type PortalKey } from "@/lib/nav/config";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";

export default async function PortalLayout(props: LayoutProps<"/[portal]">) {
  const { portal } = await props.params;
  if (!PORTALS.includes(portal as PortalKey)) notFound();
  const portalKey = portal as PortalKey;

  return (
    <div className="flex h-screen">
      <Sidebar portal={portalKey} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header portal={portalKey} />
        <main className="min-h-0 flex-1 overflow-auto bg-[var(--bg)]">{props.children}</main>
      </div>
    </div>
  );
}

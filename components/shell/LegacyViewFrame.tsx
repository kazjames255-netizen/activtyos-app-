"use client";

/**
 * Bridge for views not yet ported to React. Renders the legacy prototype
 * inside an iframe, deep-linked via its existing "kiosk mode"
 * (#kiosk=portal/view — see public/legacy/prototype.html), which hides all of
 * the legacy chrome (sidebar/topbar) and shows just the one requested view
 * full-screen. Our own Sidebar/Header (components/shell/Sidebar.tsx,
 * Header.tsx) provide the real navigation around it.
 *
 * Temporary by design: as each view gets a true React port, it moves from
 * lib/nav/config.ts into lib/view-registry.tsx and this bridge is no longer
 * used for it — no routing changes required.
 */
export function LegacyViewFrame({ portal, legacyView }: { portal: string; legacyView: string }) {
  const src = `/legacy/prototype.html#kiosk=${encodeURIComponent(portal)}/${encodeURIComponent(legacyView)}`;
  return (
    <iframe
      key={src}
      src={src}
      title={`${portal}/${legacyView} (legacy)`}
      className="h-full w-full flex-1 border-0"
    />
  );
}

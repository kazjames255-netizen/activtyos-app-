import { NextResponse, type NextRequest } from "next/server";
import { PORTALS, getDefaultView, type PortalKey } from "@/lib/nav/config";

// Bare portal URLs (/company, /platform, …) are redirect-only. Doing the hop
// here — at the edge, before any React/auth shell renders — issues a real 307
// so the browser navigates immediately. (The page.tsx redirect still works as a
// fallback, but under the client <RequireAuth> boundary it degrades to a
// client-side soft redirect that a stale bundle can strand on a blank shell.)
export function middleware(req: NextRequest) {
  const seg = req.nextUrl.pathname.replace(/^\/+|\/+$/g, "");
  if (PORTALS.includes(seg as PortalKey)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${seg}/${getDefaultView(seg as PortalKey)}`;
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
}

// Only the exact bare-portal paths trigger the middleware — everything else
// (including /company/anything) passes straight through.
export const config = {
  matcher: ["/company", "/franchise", "/freelancer", "/staff", "/custdash", "/platform"],
};

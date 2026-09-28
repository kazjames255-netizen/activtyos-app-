import { hubCatalog } from "@/lib/i18n/messages/hub";
import { LOCALES, type LocaleCode } from "@/lib/i18n/config";

// GET /i18n/hub/<locale> — that locale's Teaching Hub messages as JSON (see lib/i18n/hubMessages.ts). Built from the same source files as
// everything else (never stale); prerendered at build time, generated on request in dev. The browser keeps it for a few minutes and
// serves the stored copy while revalidating, so a return visit downloads nothing before the hub can paint.
export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => LOCALES.map((l) => ({ locale: l.code }));

export async function GET(_req: Request, ctx: { params: Promise<{ locale: string }> }) {
  const { locale } = await ctx.params;
  if (!LOCALES.some((l) => l.code === locale)) return new Response("Unknown locale", { status: 404 });
  return Response.json(hubCatalog(locale as LocaleCode), { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" } });
}

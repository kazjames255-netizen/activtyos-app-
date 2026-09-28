import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HowItWorksPage from "@/features/learninghub/howitworks/HowItWorksPage";
import { SCRIPT_LIST, topicOfScene } from "@/features/learninghub/howitworks/scripts";

// Public, no sign-in: the Teaching Hub "How it works" explainers (narrated, animated, real screens). The same player opens inside the
// hub from the "How it works" button; this route is the shareable link. ?scene=<id> starts on a given scene.
export function generateStaticParams() {
  return SCRIPT_LIST.map((s) => ({ role: s.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  const { role } = await params;
  const s = SCRIPT_LIST.find((x) => x.slug === role);
  return { title: s ? `${s.title} — Teaching Hub` : "How it works" };
}
export default async function Page({ params, searchParams }: { params: Promise<{ role: string }>; searchParams: Promise<{ scene?: string; band?: string }> }) {
  const { role } = await params;
  const { scene, band } = await searchParams;
  const script = SCRIPT_LIST.find((s) => s.slug === role);
  if (!script) notFound();
  return <HowItWorksPage role={script.role} scene={scene ?? null} topic={topicOfScene(script.role, scene)} band={band === "ks1" ? "ks1" : undefined} />;
}

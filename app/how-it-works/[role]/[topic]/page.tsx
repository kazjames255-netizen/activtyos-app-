import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HowItWorksPage from "@/features/learninghub/howitworks/HowItWorksPage";
import { requestLocale } from "@/lib/i18n/server";
import { howTitle } from "../../_meta";
import { SCRIPT_LIST, topicsFor } from "@/features/learninghub/howitworks/scripts";
import { TOPIC_ALIAS } from "@/features/learninghub/howitworks/scripts/tutorTopics";

// One short topic video: /how-it-works/tutors/homework, /how-it-works/parents/homework, /how-it-works/children/homework.
export function generateStaticParams() {
  return SCRIPT_LIST.flatMap((r) => topicsFor(r.role).map((t) => ({ role: r.slug, topic: t.topic ?? "" })));
}
export async function generateMetadata({ params }: { params: Promise<{ role: string; topic: string }> }): Promise<Metadata> {
  const { role, topic } = await params;
  const r = SCRIPT_LIST.find((x) => x.slug === role);
  const t = r && topicsFor(r.role).find((x) => x.topic === topic);
  return { title: await howTitle(await requestLocale(), t || undefined) };
}
export default async function Page({ params, searchParams }: { params: Promise<{ role: string; topic: string }>; searchParams: Promise<{ scene?: string }> }) {
  const { role, topic } = await params;
  const { scene } = await searchParams;
  const r = SCRIPT_LIST.find((x) => x.slug === role);
  if (!r) notFound();
  const alias = r.role === "tutor" ? TOPIC_ALIAS[topic] : undefined;
  if (alias) redirect(`/how-it-works/${role}/${alias}${scene ? `?scene=${scene}` : ""}`);
  if (!topicsFor(r.role).some((t) => t.topic === topic)) notFound();
  return <HowItWorksPage role={r.role} scene={scene ?? null} topic={topic} />;
}

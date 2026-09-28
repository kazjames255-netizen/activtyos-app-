"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useHowText } from "./i18n";
import HowItWorksPlayer from "./HowItWorksPlayer";
import { DirArrow } from "../rtl";
import { SCRIPT_LIST, headingFor, scriptFor, hasChooser, topicsFor } from "./scripts";
import { markDone } from "./scripts/progress";
import HowItWorksChooser from "./HowItWorksChooser";
import type { HowBand, HowRole } from "./types";

// The standalone page around the player (public link: /how-it-works/tutors | parents | children).
export default function HowItWorksPage({ role, scene, band, topic }: { role: HowRole; scene: string | null; band?: HowBand; topic?: string | null }) {
  const router = useRouter();
  const H = useHowText();
  const script = H.script(scriptFor(role, band, topic));
  const chooser = hasChooser(role) && !topic;
  const lib = topicsFor(role);
  const nextTopic = topic && hasChooser(role) ? lib[lib.findIndex((x) => x.topic === topic) + 1] : undefined;
  const done = useCallback(() => { if (topic) markDone(role, topic); }, [role, topic]);
  const base = `/how-it-works/${script.slug}`;
  return (
    <main className="hiw-page" data-testid="hiw-page" lang={H.lang} dir={H.dir}>
      <header className="hiw-page-head">
        <div>
          <p className="hiw-eyebrow">{H.ui("eyebrow", { hub: H.ui("hubTeaching") })}</p>
          <h1>{chooser ? H.script(headingFor(role)).title : script.title}</h1>
          <p className="hiw-lede">{chooser ? `${H.script(headingFor(role)).tagline} ${H.ui("pickShort")}` : script.tagline}</p>
        </div>
        <nav aria-label={H.ui("whoWatching")} className="hiw-roles">
          {SCRIPT_LIST.map((s) => (
            <Link key={s.role} href={`/how-it-works/${s.slug}`} aria-current={s.role === role ? "page" : undefined}>{H.script(s).audience}</Link>
          ))}
        </nav>
      </header>
      {chooser ? <HowItWorksChooser role={role} topics={topicsFor(role)} hrefFor={(t) => `${base}/${t}`} /> : (
        <>
          {topic && hasChooser(role) && <p><Link href={base} className="hiw-back" data-testid="hiw-all-videos"><DirArrow dir="back" /> {H.ui("allVideos")}</Link></p>}
          <HowItWorksPlayer key={`${role}:${band ?? ""}:${topic ?? ""}:${scene ?? ""}`} script={script} startScene={scene} kid={false} onFinish={done} nextVideo={nextTopic ? { label: H.ui("nextVideo", { title: H.script(nextTopic).title }), onPick: () => router.push(`${base}/${nextTopic.topic}`) } : undefined}
            onTryIt={script.tryIt && role === "tutor" ? () => router.push(`/freelancer/learninghub?tab=${script.tryIt!.sub}`) : undefined}
            others={[
              ...(topic ? [{ label: hasChooser(role) ? H.ui("allVideosPlay") : H.ui("fullTour"), onPick: () => router.push(base) }] : hasChooser(role) ? [] : lib.map((x) => ({ label: `▶ ${H.script(x).title}`, onPick: () => router.push(`${base}/${x.topic}`) }))),
              ...SCRIPT_LIST.filter((s) => s.role !== role).map((s) => ({ label: `▶ ${H.script(s).audience}`, onPick: () => router.push(`/how-it-works/${s.slug}`) })),
            ]} />
        </>
      )}
    </main>
  );
}

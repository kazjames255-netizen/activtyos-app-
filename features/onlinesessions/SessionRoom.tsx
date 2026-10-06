"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ApiError, post as apiPost } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { Button, Card } from "@/components/ui";
import { DailyFrame, type FrameFail } from "@/features/learninghub/live/LessonStage";
import { useCallObject } from "@/features/learninghub/live/board/callObject";
import type { JoinInfo } from "@/features/learninghub/live/lessonTypes";

// The room for an online session (registered as the "session" view in the parent portal and the provider portals). Our own video room (camera on by
// default, nothing recorded). The family's client confirms attendance once Daily says it really joined; the host sees End session and the stay prompt.

type Join = (JoinInfo & { mode: "platform"; title?: string }) | { mode: "own"; link: string | null; isOwner: boolean };

export function SessionRoom() {
  const t = useT();
  const sp = useSearchParams();
  const path = usePathname() ?? "";
  const portal = path.split("/")[1] || "custdash";
  const listingId = sp.get("l") ?? "";
  const date = sp.get("d") ?? "";
  const [join, setJoin] = useState<Join | null>(null);
  const [err, setErr] = useState<{ message: string; code?: string } | null>(null);
  const [left, setLeft] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [stayBusy, setStayBusy] = useState(false);
  const [stayErr, setStayErr] = useState<string | null>(null);
  const back = portal === "custdash" ? "/custdash/bookings" : `/${portal}/bookings`;

  // Join (retry while the host hasn't started: parents are held at the door, never in an empty room).
  useEffect(() => {
    if (!listingId || !date) return;
    let stop = false;
    let timer: number | undefined;
    const go = () => {
      apiPost<Join>("/api/online-sessions/join", { listingId, date })
        .then((j) => { if (stop) return; setJoin(j); setErr(null); if (j.mode === "platform") setExpires(j.roomExpiresAt ?? null); })
        .catch((e) => {
          if (stop) return;
          const code = e instanceof ApiError ? (e.body as { code?: string } | undefined)?.code : undefined;
          setErr({ message: e instanceof Error ? e.message : t("p9tx.osErrGeneric"), code });
          if (code === "waiting_for_host") timer = window.setTimeout(go, 5000);
        });
    };
    go();
    return () => { stop = true; if (timer) window.clearTimeout(timer); };
  }, [listingId, date, t, left]);

  // Attendance (families): confirmed once the call really connects.
  const call = useCallObject();
  useEffect(() => {
    if (!call || !join || join.mode !== "platform" || join.isOwner) return;
    let sent = false;
    const mark = () => { if (sent) return; sent = true; apiPost("/api/online-sessions/attended", { listingId, date }).catch(() => { sent = false; }); };
    try { if (call.meetingState?.() === "joined-meeting") mark(); } catch { /* not ready */ }
    call.on("joined-meeting", mark);
    return () => { try { call.off("joined-meeting", mark); } catch { /* call gone */ } };
  }, [call, join, listingId, date]);

  // The "stay on the call" countdown.
  useEffect(() => {
    if (!expires) return;
    const id = window.setInterval(() => setRemaining(new Date(expires).getTime() - Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expires]);

  if (!listingId || !date) return <Card className="p-5">{t("p9tx.osErrGeneric")}</Card>;
  if (left) return (
    <Card className="mx-auto max-w-[520px] p-6 text-center" data-testid="os-left">
      <div className="text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p9tx.osLeftTitle")}</div>
      <div className="mt-4 flex justify-center gap-2.5"><Button onClick={() => { setJoin(null); setErr(null); setLeft(false); }}>{t("p9tx.osRejoin")}</Button><Link href={back}><Button variant="primary">{t("p9tx.osBack")}</Button></Link></div>
    </Card>
  );
  if (err && !join) return (
    <Card className="mx-auto max-w-[520px] p-6 text-center" data-testid={err.code === "waiting_for_host" ? "os-room-waiting" : "os-room-error"}>
      <div className="text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{err.code === "waiting_for_host" ? t("p9tx.osWaiting") : t("p9tx.osCantJoin")}</div>
      <p className="mt-2 text-[14px] text-[var(--ink-2)]">{err.message}</p>
      <div className="mt-4"><Link href={back}><Button>{t("p9tx.osBack")}</Button></Link></div>
    </Card>
  );
  if (!join) return <div className="py-16 text-center text-[14px] text-[var(--ink-3)]">{t("p9tx.osOpening")}</div>;
  if (join.mode === "own") return (
    <Card className="mx-auto max-w-[520px] p-6 text-center">
      {join.link ? <a href={join.link} target="_blank" rel="noreferrer" className="inline-flex min-h-[48px] items-center rounded-full bg-[#0f9d6b] px-6 text-[15px] font-extrabold text-white">{t("p9tx.osOpenLink")}</a> : <p>{t("p9tx.osNoLink")}</p>}
    </Card>
  );

  const stay = async () => {
    setStayBusy(true); setStayErr(null);
    try { const r = await apiPost<{ roomExpiresAt: string }>("/api/online-sessions/extend", { listingId, date }); setExpires(r.roomExpiresAt); setRemaining(null); }
    catch (e) { setStayErr(e instanceof Error ? e.message : t("p9tx.osErrGeneric")); }
    finally { setStayBusy(false); }
  };
  const showStay = remaining !== null && remaining <= (join.promptSeconds ?? 120) * 1000;
  const endNow = async () => {
    if (!confirmEnd) { setConfirmEnd(true); return; }
    await apiPost("/api/online-sessions/end", { listingId, date }).catch(() => undefined);
    setLeft(true);
  };

  return (
    <div className="flex flex-col gap-2.5" data-testid="os-room">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><div className="truncate text-[17px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{join.title ?? ""}</div>{join.isOwner && <div className="text-[12px] font-bold text-[#7a4b00]">{t("p9tx.osYouAreHost")}</div>}</div>
        <div className="flex gap-2">
          {join.isOwner && <Button variant="danger" onClick={() => void endNow()} data-testid="os-end">{confirmEnd ? t("p9tx.osEndSure") : t("p9tx.osEnd")}</Button>}
          <Button onClick={() => setLeft(true)}>{t("p9tx.osLeave")}</Button>
        </div>
      </div>
      <div className="relative h-[min(72vh,640px)] min-h-[360px] overflow-hidden rounded-2xl bg-[#0b0e14]">
        <DailyFrame join={join} camOn micOn onLeft={() => setLeft(true)} onFail={(f: FrameFail) => setErr({ message: f.message })} onCameraIssue={() => undefined} />
        {showStay && (
          <div role="alertdialog" className="absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-[#e9a915] bg-[#fff6dc] p-3.5 text-[#5a3500] shadow-lg" data-testid="os-stay">
            <div className="text-[14.5px] font-extrabold">{t("p9tx.osStayTitle")}</div>
            {stayErr && <div className="mt-1 text-[12.5px] font-semibold text-[#b91c1c]">{stayErr}</div>}
            <div className="mt-2 flex gap-2"><Button variant="primary" onClick={() => void stay()} disabled={stayBusy}>{t("p9tx.osStay")}</Button><Button onClick={() => setLeft(true)}>{t("p9tx.osLeave")}</Button></div>
          </div>
        )}
      </div>
    </div>
  );
}

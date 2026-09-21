// Where Daily.co's iframe redirects to when someone leaves a call (set via
// redirect_on_meeting_exit on room creation — server/src/lib/emails.ts's
// ensureLeadVideoUrl). Replaces Daily's own generic "You've left the call /
// Have a nice day!" end screen with something on-brand. Standalone — no
// portal shell — since this renders INSIDE the video iframe, not as its own
// page visit.

export default function CallEndedPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center"
      style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.6px), linear-gradient(160deg,#16306e 0%,#132a5e 45%,#0a1a3d 100%)",
        backgroundSize: "18px 18px, cover",
        backgroundRepeat: "repeat, no-repeat",
      }}
    >
      <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-[22px] font-extrabold text-[#1d3a8f] shadow-lg">A</span>
      <div className="text-[22px] font-extrabold text-white">👋 You&rsquo;ve left the call</div>
      <p className="max-w-[320px] text-[14px] text-white/70">Thanks for your time — you can close this tab now.</p>
    </div>
  );
}

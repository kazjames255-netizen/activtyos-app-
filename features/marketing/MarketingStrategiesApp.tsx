"use client";

// Marketing strategies — parked. The full playbook/campaign-planner build stays
// in history but isn't shipped yet; the page shows a "coming soon" placeholder.
export function MarketingStrategiesApp() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-center shadow-[0_16px_40px_-24px_rgba(20,48,110,.5)]">
        <div className="px-6 py-8 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8 65%,#3fd0c9)" }}>
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/20 text-[26px]">🎯</div>
          <div className="text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Marketing strategies</div>
          <div className="mt-1 inline-block rounded-full bg-white/20 px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.06em]">Coming soon</div>
        </div>
        <div className="px-6 py-6">
          <p className="text-[13.5px] leading-[1.55] text-[var(--ink-2)]">
            We’re putting the finishing touches on your marketing toolkit — ready-made campaign playbooks,
            multi-channel plans and audience-targeted plays. It’ll land here shortly.
          </p>
          <p className="mt-3 text-[12px] text-[var(--ink-3)]">In the meantime, <b className="text-[var(--ink-2)]">Discount codes</b> and <b className="text-[var(--ink-2)]">Referrals</b> are ready to use.</p>
        </div>
      </div>
    </div>
  );
}

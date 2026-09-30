import type { ReactNode } from "react";

// The fixed public language picker sits in the top inline-end corner; on phones and tablets the explainer's header starts
// right at the top, so give it a little extra room there (the picker is ~34px tall).
export default function HowItWorksLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`@media (max-width: 900px){ .hiw-page{ padding-top: 52px !important; } }`}</style>
      {children}
    </>
  );
}

import { PlanViewer } from "@/features/plan/PlanViewer";

// Secure EHCP / SEND plan viewer, deep-linked from new-booking emails. Public
// route (no portal auth-wall); PlanViewer handles auth itself and fetches the
// file with the operator's token.
export default async function Plan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanViewer id={id} />;
}

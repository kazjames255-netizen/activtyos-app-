import { ReferenceForm } from "@/features/team/ReferenceForm";

// Public employment-reference form — the link emailed to a candidate's referee
// (/reference/{token}). No account needed; the token resolves the request and
// can only be used once.
export default async function Reference(props: PageProps<"/reference/[token]">) {
  const { token } = await props.params;
  return <ReferenceForm token={token} />;
}

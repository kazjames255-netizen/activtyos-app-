import { VerifyCertificate } from "@/features/team/VerifyCertificate";

// Public certificate verification page — the "Scan to verify" QR on a staff
// certificate points here (/v/{ref}). No account needed; the ref on the
// certificate IS the lookup (see server/src/routes/credentials.ts).
export default async function Verify(props: PageProps<"/v/[ref]">) {
  const { ref } = await props.params;
  return <VerifyCertificate certRef={ref} />;
}

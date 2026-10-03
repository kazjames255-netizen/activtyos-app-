import { PayPage } from "@/features/money/PayPage";

// Public booking pay link — what a quick-booked family gets by email (/pay/b/{token}). No account needed; the
// unguessable token pays that one booking's balance by card.
export default async function PayBooking(props: PageProps<"/pay/b/[token]">) {
  const { token } = await props.params;
  return <PayPage token={token} base="booking-pay" />;
}

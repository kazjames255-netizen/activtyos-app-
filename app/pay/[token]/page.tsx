import { PayPage } from "@/features/money/PayPage";

// Public invoice pay page — the link an operator sends a parent
// (/pay/{payToken}). No account needed; resolves the invoice by token.
export default async function Pay(props: PageProps<"/pay/[token]">) {
  const { token } = await props.params;
  return <PayPage token={token} />;
}

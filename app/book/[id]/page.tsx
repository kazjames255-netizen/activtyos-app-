import { BookPage } from "@/features/storefront/BookPage";

// The provider's public booking page — the direct link operators share
// (listing cards' 🔗 Link button copies /book/{id}). Publicly readable;
// signing in is only needed at the point of booking.
export default async function Book(props: PageProps<"/book/[id]">) {
  const { id } = await props.params;
  return <BookPage id={id} />;
}

import { redirect } from "next/navigation";

// /login routes signed-in visitors straight to their role's home portal
// (platform → Providers, company → Bookings, parent → Browse, …) and shows
// the sign-in form to everyone else.
export default function Home() {
  redirect("/login");
}

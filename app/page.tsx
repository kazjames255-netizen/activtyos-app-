import { redirect } from "next/navigation";
import { getDefaultView } from "@/lib/nav/config";

export default function Home() {
  redirect(`/admin/${getDefaultView("admin")}`);
}

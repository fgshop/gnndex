import { redirect } from "next/navigation";

export default function LoginTypoRedirectPage() {
  redirect("/auth/login");
}

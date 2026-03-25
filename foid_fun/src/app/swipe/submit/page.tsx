import { redirect } from "next/navigation";

export default function SwipeSubmitRedirect() {
  redirect("/vote/submit");
}

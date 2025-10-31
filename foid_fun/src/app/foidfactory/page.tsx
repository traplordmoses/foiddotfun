import { Metadata } from "next";
import { LaunchpadForm } from "@/components/LaunchpadForm";

export const metadata: Metadata = {
  title: "FOID Factory",
  description: "Deploy FOID20 tokens instantly or grind vanity salts ending in …f01d.",
};

export default function FoidFactoryPage() {
  return (
    <section className="py-10">
      <LaunchpadForm />
    </section>
  );
}

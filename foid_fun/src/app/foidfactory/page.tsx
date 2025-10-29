import { Metadata } from "next";
import { LaunchpadForm } from "@/components/LaunchpadForm";

export const metadata: Metadata = {
  title: "FOID Factory",
  description: "Deploy FOID20 tokens instantly or grind vanity salts ending in …f01d.",
};

export default function FoidFactoryPage() {
  return (
    <section className="space-y-8 py-10">
      <header className="space-y-3 text-white">
        <h1 className="text-3xl font-semibold">FOID Token Factory</h1>
        <p className="max-w-2xl text-sm text-white/70">
          Every launch grinds and broadcasts a FOID20 token ending in
          <span className="font-mono text-fuchsia-300"> …f01d</span>. Configure your token parameters and deploy once you
          are ready.
        </p>
      </header>
      <LaunchpadForm />
    </section>
  );
}

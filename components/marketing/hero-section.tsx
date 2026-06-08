import { ScanConfigForm } from "@/components/marketing/scan-config-form";
import { createClient } from "@/lib/supabase/server";

export const HeroSection = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium tracking-wide text-primary uppercase">
            MCP Security Scanner
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl lg:text-6xl">
            Is Your MCP Server Safe?
          </h1>
          <p className="mt-5 text-lg text-muted-foreground text-balance md:text-xl">
            Scan your MCP configuration for vulnerabilities in 30 seconds. Free.
          </p>
        </div>

        <div className="mt-12">
          <ScanConfigForm isAuthenticated={!!user} />
        </div>
      </div>
    </section>
  );
};

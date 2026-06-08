import { Separator } from "@/components/ui/separator";

const stats = [
  { value: "10,000+", label: "MCP servers scanned" },
  { value: "50+", label: "CVEs tracked" },
];

const companies = ["Vercel", "Stripe", "Linear", "Supabase", "Cursor"];

export const SocialProofSection = () => {
  return (
    <section className="border-b border-border/60 bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="flex flex-wrap justify-center gap-10 md:justify-end">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center md:text-right">
                <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <Separator orientation="vertical" className="hidden h-16 md:block" />

          <div className="text-center md:text-left">
            <p className="mb-4 text-sm text-muted-foreground">
              Trusted by developers at
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:justify-start">
              {companies.map((company) => (
                <span
                  key={company}
                  className="text-sm font-semibold tracking-wide text-muted-foreground/80"
                >
                  {company}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

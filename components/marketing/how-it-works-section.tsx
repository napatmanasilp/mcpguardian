import { Shield, Scan, Wrench, Lock } from "lucide-react";

const steps = [
  {
    icon: Scan,
    number: "01",
    title: "Paste Your MCP Config",
    description: "Drop your MCP server configuration JSON — we analyze every server, package, and permission.",
    detail: "Supports Claude Desktop, Cursor, Kiro, Windsurf, and any MCP-compatible client.",
  },
  {
    icon: Wrench,
    number: "02",
    title: "Get the Exact Fix",
    description: "We don't just tell you what's wrong. We give you the corrected config JSON you can copy-paste directly.",
    detail: "\"Pin @server-filesystem@2.0.0, add --directory ./workspace\" → Score goes from 45 to 85.",
  },
  {
    icon: Shield,
    number: "03",
    title: "Know If You'll Be Allowed",
    description: "Every scan predicts your score after fixes. You know upfront: apply these 3 changes → connection ALLOWED.",
    detail: "No guessing. Clear pass/fail with predicted outcomes.",
  },
  {
    icon: Lock,
    number: "04",
    title: "Runtime Protection (Optional)",
    description: "Route MCP traffic through our proxy. We block rug-pulls, token leaks, and injection attacks in real-time.",
    detail: "Adds ~200ms. Blocks CRITICAL threats. Monitors tool drift with 15-min watchdog.",
  },
];

export const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="border-b border-white/10">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            How MCPGuardian Works
          </h2>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto">
            From scan to fix in under 10 seconds. No security expertise required.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0">
                  <step.icon className="size-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono text-blue-400/60 uppercase tracking-widest">
                    Step {step.number}
                  </span>
                  <h3 className="text-base font-semibold text-slate-200 mt-0.5">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                    {step.description}
                  </p>
                  <p className="text-xs text-slate-500 mt-2 font-mono">
                    {step.detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

"use client";

import { Check, Minus } from "lucide-react";

export type FeatureValue = boolean | string;

export interface FeatureRow {
  label: string;
  free: FeatureValue;
  developer: FeatureValue;
  team: FeatureValue;
  startup: FeatureValue;
  enterprise: FeatureValue;
}

export const FEATURES: FeatureRow[] = [
  {
    label: "Scans/month",
    free: "50",
    developer: "100",
    team: "500",
    startup: "2,000",
    enterprise: "Unlimited",
  },
  {
    label: "Tool calls/month",
    free: false,
    developer: "25,000",
    team: "100,000",
    startup: "500,000",
    enterprise: "Unlimited",
  },
  {
    label: "Seats",
    free: "1",
    developer: "3",
    team: "10",
    startup: "Unlimited",
    enterprise: "Unlimited",
  },
  {
    label: "MCP servers",
    free: "1",
    developer: "5",
    team: "25",
    startup: "100",
    enterprise: "Unlimited",
  },
  {
    label: "Runtime proxy protection",
    free: false,
    developer: true,
    team: true,
    startup: true,
    enterprise: true,
  },
  {
    label: "Sandbox execution",
    free: false,
    developer: true,
    team: true,
    startup: true,
    enterprise: true,
  },
  {
    label: "NSA compliance reports",
    free: false,
    developer: true,
    team: true,
    startup: true,
    enterprise: true,
  },
  {
    label: "Support tier",
    free: "Email",
    developer: "Email + Webhooks",
    team: "Email + API",
    startup: "Priority",
    enterprise: "Dedicated engineer",
  },
  {
    label: "Scan retention",
    free: "7 days",
    developer: "30 days",
    team: "90 days",
    startup: "1 year",
    enterprise: "7 years",
  },
];

export const PLAN_HEADERS = ["Free", "Developer", "Team", "Startup", "Enterprise"] as const;

export function CellContent({ value }: { value: FeatureValue }) {
  if (value === true) {
    return <Check className="size-4 text-secure mx-auto" />;
  }
  if (value === false) {
    return <Minus className="size-4 text-slate-600 mx-auto" />;
  }
  return <span className="text-xs text-slate-300">{value}</span>;
}

export function FeatureComparisonTable() {
  return (
    <div className="max-w-6xl mx-auto w-full">
      <h2 className="text-lg font-semibold text-slate-300 mb-4">
        Feature Comparison
      </h2>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-[hsl(222,47%,8%)]">
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">
                Feature
              </th>
              {PLAN_HEADERS.map((plan) => (
                <th
                  key={plan}
                  className="text-center text-xs text-slate-300 font-medium px-4 py-3"
                >
                  {plan}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((feature) => (
              <tr
                key={feature.label}
                className="border-b border-white/5 last:border-b-0"
              >
                <td className="text-xs text-slate-400 px-4 py-3">
                  {feature.label}
                </td>
                <td className="text-center px-4 py-3">
                  <CellContent value={feature.free} />
                </td>
                <td className="text-center px-4 py-3">
                  <CellContent value={feature.developer} />
                </td>
                <td className="text-center px-4 py-3">
                  <CellContent value={feature.team} />
                </td>
                <td className="text-center px-4 py-3">
                  <CellContent value={feature.startup} />
                </td>
                <td className="text-center px-4 py-3">
                  <CellContent value={feature.enterprise} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

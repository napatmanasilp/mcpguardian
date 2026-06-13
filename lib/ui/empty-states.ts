import {
  Activity,
  Bell,
  BarChart3,
  Radar,
  Server,
  Shield,
} from "lucide-react";

import type { EmptyStateProps } from "@/components/ui/empty-state";

/**
 * Registry of empty state configurations for all data pages.
 * Each entry provides the icon, heading, description, and optional CTA
 * to render when a page has zero records.
 */
export const EMPTY_STATES: Record<string, EmptyStateProps> = {
  servers: {
    icon: Server,
    heading: "No servers registered",
    description: "Register your first MCP server to start monitoring and securing your infrastructure.",
    cta: { label: "Add your first server", href: "/servers/new" },
  },
  sessions: {
    icon: Activity,
    heading: "No sessions recorded",
    description: "Sessions will appear here once your proxy is connected and traffic flows through.",
    cta: { label: "Connect your proxy", href: "/onboarding/proxy-setup" },
  },
  activity: {
    icon: Radar,
    heading: "No threats detected",
    description: "Your servers are running clean.",
  },
  alerts: {
    icon: Bell,
    heading: "No alerts",
    description: "All clear — no security alerts to show.",
  },
  telemetry: {
    icon: BarChart3,
    heading: "No telemetry data",
    description: "Telemetry data will appear once you have servers reporting health metrics.",
    cta: { label: "Add a server", href: "/servers/new" },
  },
  compliance: {
    icon: Shield,
    heading: "No compliance data",
    description: "Run your first scan to generate a compliance assessment.",
  },
};

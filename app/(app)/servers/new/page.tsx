import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = {
  title: "Add Server — MCPGuardian",
  description: "Register a new MCP server for security scanning and monitoring.",
};

// Code-split: AddServerForm is a heavy client component with form state management,
// Zod validation, and multiple input modes. Only needed on this specific page.
// Requirement 20.1: code-split client components > 50 KB not needed on initial render
const AddServerForm = dynamic(
  () =>
    import("@/components/servers/add-server-form").then(
      (mod) => mod.AddServerForm,
    ),
  {
    loading: () => (
      <PageSkeleton blocks={[{ type: "card", height: "24rem" }]} />
    ),
  },
);

export default function AddServerPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <AddServerForm />
    </main>
  );
}

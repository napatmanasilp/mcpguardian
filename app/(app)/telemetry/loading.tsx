import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function TelemetryLoading() {
  return (
    <PageSkeleton
      blocks={[
        { type: "header", height: "3rem" },
        { type: "card", height: "5rem" },
        { type: "card", height: "4rem" },
        { type: "card", height: "4rem" },
        { type: "card", height: "4rem" },
        { type: "card", height: "4rem" },
      ]}
    />
  );
}

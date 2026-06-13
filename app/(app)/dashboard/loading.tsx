import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function DashboardLoading() {
  return (
    <PageSkeleton
      blocks={[
        { type: "header", height: "3rem" },
        { type: "card", height: "4rem" },
        { type: "card", height: "3.5rem" },
        { type: "card", height: "12rem" },
        { type: "card", height: "10rem" },
        { type: "card", height: "8rem" },
      ]}
    />
  );
}

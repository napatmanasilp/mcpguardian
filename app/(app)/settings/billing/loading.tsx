import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function BillingSettingsLoading() {
  return (
    <PageSkeleton
      blocks={[
        { type: "header", height: "3rem" },
        { type: "card", height: "10rem" },
        { type: "card", height: "12rem" },
        { type: "card", height: "6rem" },
        { type: "card", height: "8rem" },
      ]}
    />
  );
}

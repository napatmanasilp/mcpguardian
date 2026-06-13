import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function GeneralSettingsLoading() {
  return (
    <PageSkeleton
      blocks={[
        { type: "header", height: "3rem" },
        { type: "card", height: "10rem" },
        { type: "card", height: "6rem" },
        { type: "card", height: "5rem" },
        { type: "card", height: "5rem" },
      ]}
    />
  );
}

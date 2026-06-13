import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function TeamSettingsLoading() {
  return (
    <PageSkeleton
      blocks={[
        { type: "header", height: "3rem" },
        { type: "card", height: "16rem" },
      ]}
    />
  );
}

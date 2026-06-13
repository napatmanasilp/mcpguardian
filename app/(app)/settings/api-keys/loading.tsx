import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function ApiKeysSettingsLoading() {
  return (
    <PageSkeleton
      blocks={[
        { type: "header", height: "3rem" },
        { type: "card", height: "16rem" },
      ]}
    />
  );
}

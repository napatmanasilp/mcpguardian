"use client";

import { useRouter } from "next/navigation";

import { RescanButton } from "./rescan-button";

interface RescanButtonWithRefreshProps {
  serverId: string;
}

export function RescanButtonWithRefresh({ serverId }: RescanButtonWithRefreshProps) {
  const router = useRouter();

  return (
    <RescanButton
      serverId={serverId}
      onSuccess={() => {
        router.refresh();
      }}
    />
  );
}

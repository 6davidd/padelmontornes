import "server-only";

import { getOpenMatchesCountForMember } from "@/lib/server-open-matches-count";
import OpenMatchesCountBadge from "./OpenMatchesCountBadge";

type HomeOpenMatchesCountBadgeProps = {
  enabled: boolean;
  accessToken: string;
  currentUserId: string | null;
};

export default async function HomeOpenMatchesCountBadge({
  enabled,
  accessToken,
  currentUserId,
}: HomeOpenMatchesCountBadgeProps) {
  let count = 0;

  if (enabled && currentUserId) {
    try {
      count = await getOpenMatchesCountForMember({
        accessToken,
        currentUserId,
      });
    } catch (error) {
      console.error("Error loading home open matches count", error);
    }
  }

  return <OpenMatchesCountBadge enabled={enabled} count={count} />;
}

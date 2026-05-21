import { RouteLoadingSkeleton } from "../../../_components/RouteLoadingSkeleton";

export default function WhatsappSummaryLoading() {
  return (
    <RouteLoadingSkeleton titleWidth="w-64" showChips={false} sections={1} />
  );
}

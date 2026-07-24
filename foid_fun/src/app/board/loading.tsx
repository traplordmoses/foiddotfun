import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

export default function BoardLoading() {
  return (
    <RouteLoadingShell
      pageClassName="board-page"
      maxWidthClassName="max-w-[1800px]"
      title="MIFOID_LOREBOARD.APP"
      label="loading board..."
    />
  );
}

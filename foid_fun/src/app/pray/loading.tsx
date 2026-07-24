import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

export default function PrayLoading() {
  return (
    <RouteLoadingShell
      pageClassName="pray-page"
      maxWidthClassName="max-w-[1800px]"
      title="FOID_MOMMY_TERMINAL.EXE"
      label="loading terminal..."
    />
  );
}

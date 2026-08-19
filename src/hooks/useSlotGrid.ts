import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAvailableSlots } from "@/services/rpc";
import { getUnavailableSlotsForBranch } from "@/services/availabilityService";
import {
  getWorkingHours,
  getSlotGranularityMinutes,
} from "@/services/settingsService";

export type SlotStatus = "available" | "locked" | "booked";

export interface SlotCell {
  start: string;
  end: string;
  status: SlotStatus;
}

/** Adds N hours to an ISO instant without relying on a named timezone (matches the fixed-offset convention used throughout the backend). */
function addHours(iso: string, hours: number): Date {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000);
}

export function useSlotGrid(params: {
  branchId: string | null;
  fieldSectionId: string | null;
  date: string | null;
}) {
  const { branchId, fieldSectionId, date } = params;

  const workingHoursQuery = useQuery({
    queryKey: ["settings", "working-hours"],
    queryFn: getWorkingHours,
    staleTime: 5 * 60 * 1000,
  });

  const granularityQuery = useQuery({
    queryKey: ["settings", "slot-granularity"],
    queryFn: getSlotGranularityMinutes,
    staleTime: 5 * 60 * 1000,
  });

  const availableQuery = useQuery({
    queryKey: ["available-slots", fieldSectionId, date],
    queryFn: () =>
      getAvailableSlots({
        fieldSectionId: fieldSectionId as string,
        date: date as string,
      }),
    enabled: Boolean(fieldSectionId && date),
    // Anon has no RLS visibility into bookings/booking_locks (by design —
    // see docs/DATABASE.md), so a true Postgres Realtime subscription to
    // "someone just booked/locked this slot" isn't possible for
    // customers without weakening that protection. Short-interval
    // polling through the same authoritative RPC is the secure
    // alternative: it never re-derives availability itself, just asks
    // the source of truth more often while the grid is open.
    refetchInterval: 15_000,
  });

  const unavailableQuery = useQuery({
    queryKey: ["unavailable-slots", branchId, date],
    queryFn: () => {
      if (!branchId || !date || !workingHoursQuery.data)
        return Promise.resolve([]);
      const dayStart = new Date(`${date}T00:00:00Z`);
      const dayEnd = new Date(dayStart.getTime() + 2 * 24 * 60 * 60 * 1000); // generous 2-day window covers the overnight session
      return getUnavailableSlotsForBranch({
        branchId,
        dayStart: dayStart.toISOString(),
        dayEnd: dayEnd.toISOString(),
      });
    },
    enabled: Boolean(branchId && date && workingHoursQuery.data),
    refetchInterval: 15_000,
  });

  const slots = useMemo<SlotCell[]>(() => {
    if (
      !date ||
      !workingHoursQuery.data ||
      !granularityQuery.data ||
      !availableQuery.data
    )
      return [];

    const { openHour, closeHour, timezoneOffsetHours } = workingHoursQuery.data;
    const granularityMs = granularityQuery.data * 60 * 1000;

    // Window boundaries, mirroring compute_window_for_date on the backend:
    // fixed-offset arithmetic, never a named timezone.
    const localMidnight = new Date(`${date}T00:00:00Z`);
    const windowStart = new Date(
      addHours(localMidnight.toISOString(), openHour).getTime() -
        timezoneOffsetHours * 60 * 60 * 1000,
    );
    const nextDay = new Date(localMidnight.getTime() + 24 * 60 * 60 * 1000);
    const windowEnd = new Date(
      addHours(nextDay.toISOString(), closeHour).getTime() -
        timezoneOffsetHours * 60 * 60 * 1000,
    );

    console.log("AVAILABLE FROM RPC:", availableQuery.data);
    console.log("GENERATED WINDOW:", {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });

    const availableStarts = new Set(
      availableQuery.data.map((s) => new Date(s.slotStart).getTime()),
    );
    const unavailable = unavailableQuery.data ?? [];

    const cells: SlotCell[] = [];
    for (
      let start = windowStart.getTime();
      start < windowEnd.getTime();
      start += granularityMs
    ) {
      const startDate = new Date(start);
      const endDate = new Date(start + granularityMs);
      const startIso = startDate.toISOString();

      let status: SlotStatus;
      if (availableStarts.has(startDate.getTime())) {
        status = "available";
      } else {
        // Not available. Distinguish "locked" vs "booked" as a best-effort
        // presentational hint only — both are equally non-clickable, so
        // this never affects what the customer can actually do (see
        // availabilityService.ts). A slot only unavailable via a related
        // section's booking (cross-section conflict) has no direct
        // same-section row here, so it safely falls back to "booked".
        const matchingLock = unavailable.find(
          (u) =>
            u.fieldSectionId === fieldSectionId &&
            u.source === "lock" &&
            new Date(u.startsAt) < endDate &&
            new Date(u.endsAt) > startDate,
        );
        status = matchingLock ? "locked" : "booked";
      }

      cells.push({ start: startIso, end: endDate.toISOString(), status });
    }

    return cells;
  }, [
    date,
    workingHoursQuery.data,
    granularityQuery.data,
    availableQuery.data,
    unavailableQuery.data,
    fieldSectionId,
  ]);

  return {
    slots,
    isLoading:
      workingHoursQuery.isLoading ||
      granularityQuery.isLoading ||
      availableQuery.isLoading,
    isError:
      workingHoursQuery.isError ||
      granularityQuery.isError ||
      availableQuery.isError,
    refetch: () => {
      void availableQuery.refetch();
      void unavailableQuery.refetch();
    },
  };
}

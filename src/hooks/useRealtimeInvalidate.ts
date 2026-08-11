import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { RealtimePostgresChangesFilter } from "@supabase/supabase-js";

import { supabase } from "@/config/supabase";

/**
 * Subscribes to Postgres changes on one table and invalidates the given
 * React Query keys when anything changes — it never updates UI state
 * directly from the realtime payload. The subsequent refetch goes
 * through the existing RPC/service layer, which remains the sole
 * authority on availability/conflicts/stats; this hook is purely a
 * "something changed, go re-ask the source of truth" signal.
 *
 * Realtime respects each table's RLS for the subscribing role's JWT —
 * an anon session receives nothing for admin-only tables
 * (bookings/booking_locks/closed_slots), by design. This hook is
 * therefore only meaningful for authenticated admin views. See the
 * Phase 5 migration for which tables are enabled for replication.
 */
export function useRealtimeInvalidate(params: {
  channelName: string;
  table: string;
  filter?: string; // e.g. `branch_id=eq.<uuid>`
  queryKeys: QueryKey[];
  enabled?: boolean;
}) {
  const { channelName, table, filter, enabled = true } = params;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const changesFilter: RealtimePostgresChangesFilter<"*"> = filter
      ? { event: "*", schema: "public", table, filter }
      : { event: "*", schema: "public", table };

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", changesFilter, () => {
        params.queryKeys.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryClient/queryKeys intentionally excluded: re-subscribing on every render (e.g. from a new inline array literal) would thrash the websocket channel. channelName/table/filter/enabled are the only inputs that should ever cause a re-subscribe.
  }, [channelName, table, filter, enabled]);
}

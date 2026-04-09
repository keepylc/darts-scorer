import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useCallback, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { GameState } from "@/lib/types";

export function useGamePolling(shareCode: string) {
  const queryClient = useQueryClient();
  const lastUpdatedAt = useRef<number>(0);
  const errorCount = useRef<number>(0);

  const query = useQuery<GameState | undefined>({
    queryKey: ["/api/games", shareCode],
    queryFn: async (): Promise<GameState | undefined> => {
      try {
        const url = lastUpdatedAt.current > 0
          ? `/api/games/${shareCode}/poll?since=${lastUpdatedAt.current}`
          : `/api/games/${shareCode}`;
        const res = await apiRequest("GET", url);
        const data = await res.json();
        errorCount.current = 0;

        if (data.noChange) {
          // Return previous data unchanged
          return queryClient.getQueryData<GameState>(["/api/games", shareCode]);
        }

        lastUpdatedAt.current = data.updatedAt || data.game?.updatedAt || 0;
        return data as GameState;
      } catch (err) {
        errorCount.current++;
        throw err;
      }
    },
    refetchInterval: () => {
      // Exponential backoff on errors: 2s → 4s → 8s → 16s → 30s max
      if (errorCount.current > 0) {
        return Math.min(2000 * Math.pow(2, errorCount.current - 1), 30000);
      }
      return 2000;
    },
    refetchIntervalInBackground: false,
    staleTime: Infinity,
    retry: false,
  });

  // Reset updatedAt when shareCode changes
  useEffect(() => {
    lastUpdatedAt.current = 0;
    errorCount.current = 0;
  }, [shareCode]);

  const invalidate = useCallback(() => {
    lastUpdatedAt.current = 0;
    queryClient.invalidateQueries({ queryKey: ["/api/games", shareCode] });
  }, [queryClient, shareCode]);

  return {
    gameState: query.data,
    isLoading: query.isLoading,
    error: query.error,
    invalidate,
  };
}

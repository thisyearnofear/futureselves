import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const SAVED_SIGNAL_PINS_KEY = "futureself.savedSignalPins";

export function useSavedSignalPins() {
  const [pinnedSignalIds, setPinnedSignalIds] = useState<Array<string>>([]);
  const [isLoaded, setIsLoaded] = useState(Platform.OS === "web");

  useEffect(() => {
    if (Platform.OS === "web") return;

    let active = true;
    async function load() {
      try {
        const stored = await SecureStore.getItemAsync(SAVED_SIGNAL_PINS_KEY);
        if (!stored || !active) return;
        const parsed = JSON.parse(stored) as Array<string>;
        setPinnedSignalIds(Array.isArray(parsed) ? parsed : []);
      } catch {
        // fall back to empty pins
      } finally {
        if (active) setIsLoaded(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const savePins = useCallback(async (next: Array<string>) => {
    setPinnedSignalIds(next);
    if (Platform.OS === "web") return;
    try {
      await SecureStore.setItemAsync(SAVED_SIGNAL_PINS_KEY, JSON.stringify(next));
    } catch {
      // keep in-memory pins even if persistence fails
    }
  }, []);

  const togglePinnedSignal = useCallback(
    async (signalId: string) => {
      const next = pinnedSignalIds.includes(signalId)
        ? pinnedSignalIds.filter((id) => id !== signalId)
        : [signalId, ...pinnedSignalIds];
      await savePins(next);
    },
    [pinnedSignalIds, savePins],
  );

  return {
    pinnedSignalIds,
    isLoaded,
    togglePinnedSignal,
  };
}

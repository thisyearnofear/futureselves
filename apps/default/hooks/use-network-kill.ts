/**
 * use-network-kill.ts
 *
 * Listens to the OS network state and exposes `isOffline` plus a
 * developer-controlled "kill switch" toggle. The demo video shows
 * airplane mode engaged with a visible `fetch()` error in the console
 * while the transmission still arrives — this hook powers that UX.
 *
 * ## Rules
 * - Web is always "online" (the marketing site is a live demo surface).
 * - Native uses `expo-network` to detect real connectivity.
 * - `toggleKillSwitch()` flips a dev-only state so the app behaves as
 *   if offline even when the OS is connected.
 *
 * See `docs/edge-ai-qvac.md` §3.5 #7 for the network-kill test spec.
 */

import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Network from "expo-network";

/**
 * Internal shape returned by `expo-network`'s `getNetworkStateAsync`.
 * We type it narrowly so we don't need to depend on the full SDK types
 * leaking into the public API of this hook.
 */
interface NetworkState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
}

export interface UseNetworkKillResult {
  /**
   * `true` when the device has no network connectivity OR when the
   * developer kill-switch is engaged. On web this is always `false`.
   */
  isOffline: boolean;

  /**
   * `true` when the OS reports a network connection. If `isOffline`
   * is also `false`, the app is live.
   */
  isConnected: boolean;

  /**
   * The raw connectivity type reported by the OS (e.g. `"wifi"`,
   * `"cellular"`, `"none"`, `"unknown"`). Useful for the memory
   * readout chip.
   */
  connectionType: string;

  /**
   * Flip the developer kill-switch. Only meaningful when `DEBUG_MODE`
   * is enabled. Toggles `isOffline` without changing the real OS
   * network state.
   */
  toggleKillSwitch: () => void;

  /**
   * Whether the kill-switch is currently engaged.
   */
  killSwitchEngaged: boolean;
}

const DEBUG_MODE =
  typeof __DEV__ !== "undefined" ? __DEV__ : false;

export function useNetworkKill(): UseNetworkKillResult {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState("unknown");
  const [killSwitch, setKillSwitch] = useState(false);

  // Poll the real OS network state every 4 s on native.
  useEffect(() => {
    if (Platform.OS === "web") return;

    let mounted = true;

    async function poll() {
      try {
        const state: Network.NetworkState = await Network.getNetworkStateAsync();
        if (!mounted) return;
        setIsConnected(state.isConnected ?? false);
        setConnectionType(state.type ?? "unknown");
      } catch {
        if (mounted) {
          setIsConnected(false);
          setConnectionType("unknown");
        }
      }
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const toggleKillSwitch = useCallback(() => {
    if (!DEBUG_MODE) return;
    setKillSwitch((prev) => !prev);
  }, []);

  const isOffline =
    Platform.OS === "web"
      ? false
      : !isConnected || killSwitch;

  return {
    isOffline,
    isConnected,
    connectionType,
    toggleKillSwitch,
    killSwitchEngaged: killSwitch,
  };
}

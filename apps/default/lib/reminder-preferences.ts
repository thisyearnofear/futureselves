import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export interface ReminderPreferences {
  enabled: boolean;
  hour: number;
  minute: number;
}

const REMINDER_PREFERENCES_KEY = "futureself.reminderPreferences";

const defaultReminderPreferences: ReminderPreferences = {
  enabled: false,
  hour: 20,
  minute: 0,
};

export function useReminderPreferences() {
  const [preferences, setPreferences] = useState<ReminderPreferences>(
    defaultReminderPreferences,
  );
  const [isLoaded, setIsLoaded] = useState(Platform.OS === "web");

  useEffect(() => {
    if (Platform.OS === "web") return;

    let active = true;
    async function load() {
      try {
        const stored = await SecureStore.getItemAsync(REMINDER_PREFERENCES_KEY);
        if (!stored || !active) return;
        const parsed = JSON.parse(stored) as Partial<ReminderPreferences>;
        setPreferences({
          enabled: parsed.enabled ?? defaultReminderPreferences.enabled,
          hour: parsed.hour ?? defaultReminderPreferences.hour,
          minute: parsed.minute ?? defaultReminderPreferences.minute,
        });
      } catch {
        // fall back to defaults
      } finally {
        if (active) setIsLoaded(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const savePreferences = useCallback(async (next: ReminderPreferences) => {
    setPreferences(next);
    if (Platform.OS === "web") return;
    try {
      await SecureStore.setItemAsync(
        REMINDER_PREFERENCES_KEY,
        JSON.stringify(next),
      );
    } catch {
      // keep in-memory state even if persistence fails
    }
  }, []);

  return {
    preferences,
    isLoaded,
    savePreferences,
  };
}

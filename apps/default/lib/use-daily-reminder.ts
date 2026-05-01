import { useEffect } from "react";
import { Platform } from "react-native";
import type { ReminderPreferences } from "@/lib/reminder-preferences";

/**
 * Schedules or cancels a daily push notification reminder from explicit user
 * preferences. Uses expo-notifications on native; no-ops on web (web push requires
 * service workers which are out of scope for the Expo managed workflow).
 *
 * Safe to call repeatedly — cancels existing reminders before scheduling.
 */
export function useDailyReminder(preferences: ReminderPreferences, isLoaded = true) {
  useEffect(() => {
    if (Platform.OS === "web" || !isLoaded) return;

    let cancelled = false;

    async function schedule() {
      try {
        const Notifications = await import("expo-notifications");

        await Notifications.cancelAllScheduledNotificationsAsync();

        if (!preferences.enabled || cancelled) return;

        const { status: existing } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted" || cancelled) return;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🔮 Your future self has something to say today",
            body: "One word is all it takes. The signal is waiting.",
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: preferences.hour,
            minute: preferences.minute,
          },
        });
      } catch {
        // expo-notifications not installed or permissions denied — silent no-op
      }
    }

    void schedule();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, preferences.enabled, preferences.hour, preferences.minute]);
}

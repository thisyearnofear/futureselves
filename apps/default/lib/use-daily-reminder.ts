import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Schedules a daily push notification reminder at 9 AM local time.
 * Uses expo-notifications on native; no-ops on web (web push requires
 * service workers which are out of scope for the Expo managed workflow).
 *
 * Safe to call repeatedly — cancels existing reminders before scheduling.
 */
export function useDailyReminder() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    let cancelled = false;

    async function schedule() {
      try {
        const Notifications = await import("expo-notifications");

        const { status: existing } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted" || cancelled) return;

        // Cancel any previous daily reminders we set
        await Notifications.cancelAllScheduledNotificationsAsync();

        // Schedule daily at 9 AM
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🔮 Your future self has something to say today",
            body: "One word is all it takes. The signal is waiting.",
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 9,
            minute: 0,
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
  }, []);
}

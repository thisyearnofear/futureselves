import { useEffect } from "react";
import { Platform } from "react-native";
import type { ReminderPreferences } from "@/lib/reminder-preferences";

/**
 * Schedules or cancels a daily local notification reminder from explicit user
 * preferences. Uses expo-notifications on native; no-ops on web (web push requires
 * service workers which are out of scope for the Expo managed workflow).
 *
 * Safe to call repeatedly — cancels existing reminders before scheduling.
 *
 * When the latest transmission carries a cliffhanger, the notification copy
 * becomes the return hook itself ("Yesterday's voice left something
 * unfinished…") instead of a generic reminder — the serialized story is the
 * strongest reason to come back.
 */
export function useDailyReminder(
  preferences: ReminderPreferences,
  isLoaded = true,
  context?: { cliffhanger?: string },
) {
  const cliffhanger = context?.cliffhanger?.trim();

  useEffect(() => {
    if (Platform.OS === "web" || !isLoaded) return;

    const scheduledTitle = cliffhanger
      ? "Yesterday's voice left something unfinished…"
      : "Your future self checked in today. Did you?";
    const scheduledBody = cliffhanger
      ? `\u201C${cliffhanger.slice(0, 120)}${cliffhanger.length > 120 ? "…" : ""}\u201D — one word from you keeps the night moving.`
      : "One word and a choice. That's all the line needs from you tonight.";

    let unmounted = false;

    async function schedule() {
      try {
        const Notifications = await import("expo-notifications");

        await Notifications.cancelAllScheduledNotificationsAsync();

        if (!preferences.enabled || unmounted) return;

        const { status: existing } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted" || unmounted) return;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: scheduledTitle,
            body: scheduledBody,
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
      unmounted = true;
    };
  }, [
    isLoaded,
    preferences.enabled,
    preferences.hour,
    preferences.minute,
    cliffhanger,
  ]);
}

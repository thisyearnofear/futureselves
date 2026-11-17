import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * True when the OS requests reduced motion (iOS Reduce Motion / Android
 * remove-animations). Every decorative animation in the app should gate on
 * this and render its final state instead — see docs/design.md motion rules.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        if (mounted) setReduceMotion(enabled);
      },
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

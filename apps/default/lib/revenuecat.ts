/**
 * revenuecat.ts
 *
 * RevenueCat SDK lifecycle for native platforms. See docs/shipaton-2026.md
 * for the full design (entitlement mapping, identity mapping, sync
 * architecture). This file follows the same platform-extension convention
 * as lib/qvac.ts / lib/qvac.web.ts — apps/default/lib/revenuecat.web.ts is
 * a no-op counterpart for web, since react-native-purchases' purchase flow
 * doesn't work on web without a separate RevenueCat Billing/Stripe setup
 * this project doesn't have.
 *
 * The RevenueCat dashboard entitlement identifier this app checks is
 * "awakened" — see AWAKENED_ENTITLEMENT_ID below, kept in sync with
 * packages/backend/convex/revenuecat.ts's AWAKENED_ENTITLEMENT_ID constant.
 */

import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

export const AWAKENED_ENTITLEMENT_ID = "awakened";

let configured = false;

/**
 * Configures the RevenueCat SDK. Safe to call multiple times — no-ops
 * after the first successful configure. Also no-ops if the platform API
 * key isn't set, so a fresh clone without RevenueCat credentials still
 * builds and runs (the premium tier is just unpurchasable until
 * configured — see docs/shipaton-2026.md's "what you still need to do").
 */
export function configureRevenueCat(): void {
  if (configured) return;

  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY;

  if (!apiKey) {
    console.warn(
      "[RevenueCat] No API key configured for this platform — purchases are disabled. See docs/shipaton-2026.md.",
    );
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
  }
  Purchases.configure({ apiKey });
  configured = true;
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

/**
 * Associates the RevenueCat customer with the Convex auth user id, so
 * every webhook event's app_user_id matches a Convex users._id directly.
 * Call once per session, after Convex auth resolves and before presenting
 * any paywall. Safe to call if RevenueCat isn't configured — no-ops.
 */
export async function identifyRevenueCatUser(convexUserId: string): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logIn(convexUserId);
  } catch (error) {
    console.warn("[RevenueCat] logIn failed:", error);
  }
}

function hasAwakenedEntitlement(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return typeof customerInfo.entitlements.active[AWAKENED_ENTITLEMENT_ID] !== "undefined";
}

export interface UseCustomerInfoResult {
  customerInfo: CustomerInfo | null;
  isAwakened: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Fetches and subscribes to CustomerInfo updates. Returns isAwakened as a
 * convenience — this reflects RevenueCat's live entitlement state, distinct
 * from (and normally in sync with, via the webhook + syncEntitlementFromClient)
 * the Convex-side personas.tier field that the rest of the app reads.
 */
export function useCustomerInfo(): UseCustomerInfoResult {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!configured) {
      setIsLoading(false);
      return;
    }
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (error) {
      console.warn("[RevenueCat] getCustomerInfo failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      setIsLoading(false);
      return;
    }
    void refresh();
    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [refresh]);

  return {
    customerInfo,
    isAwakened: hasAwakenedEntitlement(customerInfo),
    isLoading,
    refresh,
  };
}

/** Convenience hook for call sites that only care about the boolean. */
export function useIsAwakened(): boolean {
  return useCustomerInfo().isAwakened;
}

export interface PurchaseResult {
  success: boolean;
  isAwakened: boolean;
  userCancelled: boolean;
  error?: string;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return {
      success: true,
      isAwakened: hasAwakenedEntitlement(customerInfo),
      userCancelled: false,
    };
  } catch (error) {
    const rcError = error as { userCancelled?: boolean; message?: string };
    return {
      success: false,
      isAwakened: false,
      userCancelled: Boolean(rcError?.userCancelled),
      error: rcError?.message ?? "Purchase failed",
    };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return {
      success: true,
      isAwakened: hasAwakenedEntitlement(customerInfo),
      userCancelled: false,
    };
  } catch (error) {
    const rcError = error as { message?: string };
    return {
      success: false,
      isAwakened: false,
      userCancelled: false,
      error: rcError?.message ?? "Restore failed",
    };
  }
}

export type AwakenedPaywallResult = "purchased" | "restored" | "cancelled" | "error" | "not_presented";

/**
 * Presents RevenueCat's dashboard-configured paywall only if the "awakened"
 * entitlement isn't already active (presentPaywallIfNeeded dismisses
 * automatically once it is). No-ops with "not_presented" if RevenueCat
 * isn't configured, so call sites don't need their own platform/config
 * checks. See docs/shipaton-2026.md.
 */
export async function presentAwakenedPaywall(): Promise<AwakenedPaywallResult> {
  if (!configured) return "not_presented";

  const { default: RevenueCatUI, PAYWALL_RESULT } = await import("react-native-purchases-ui");
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: AWAKENED_ENTITLEMENT_ID,
    });
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        return "purchased";
      case PAYWALL_RESULT.RESTORED:
        return "restored";
      case PAYWALL_RESULT.CANCELLED:
        return "cancelled";
      default:
        return "not_presented";
    }
  } catch (error) {
    console.warn("[RevenueCat] presentPaywallIfNeeded failed:", error);
    return "error";
  }
}

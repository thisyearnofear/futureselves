/**
 * revenuecat.web.ts
 *
 * Web counterpart of lib/revenuecat.ts. react-native-purchases' purchase
 * flow requires RevenueCat Billing + Stripe for web, which this project
 * doesn't set up (mobile-only IAP, matching the primary Shipaton
 * requirement — see docs/shipaton-2026.md). All exports here are safe
 * no-ops so shared UI code (paywall gates, Settings) doesn't need
 * Platform.OS branching at every call site.
 */

import { useState } from "react";

export const AWAKENED_ENTITLEMENT_ID = "awakened";

export function configureRevenueCat(): void {
  // no-op on web
}

export function isRevenueCatConfigured(): boolean {
  return false;
}

export async function identifyRevenueCatUser(_convexUserId: string): Promise<void> {
  // no-op on web
}

export interface UseCustomerInfoResult {
  customerInfo: null;
  isAwakened: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useCustomerInfo(): UseCustomerInfoResult {
  const [isLoading] = useState(false);
  const refresh = async () => {};
  return { customerInfo: null, isAwakened: false, isLoading, refresh };
}

export function useIsAwakened(): boolean {
  return false;
}

export interface PurchaseResult {
  success: boolean;
  isAwakened: boolean;
  userCancelled: boolean;
  error?: string;
}

export async function purchasePackage(_pkg?: unknown): Promise<PurchaseResult> {
  return {
    success: false,
    isAwakened: false,
    userCancelled: false,
    error: "Purchases are not available on web.",
  };
}

export async function restorePurchases(): Promise<PurchaseResult> {
  return {
    success: false,
    isAwakened: false,
    userCancelled: false,
    error: "Purchases are not available on web.",
  };
}

export type AwakenedPaywallResult = "purchased" | "restored" | "cancelled" | "error" | "not_presented";

export async function presentAwakenedPaywall(): Promise<AwakenedPaywallResult> {
  return "not_presented";
}

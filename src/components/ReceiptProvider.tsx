"use client";
/**
 * The café's own receipt (0091) for a page that prints checks from many places
 * (Orders: a refund's slip from any row): the page reads it once, and each
 * slip printed under it prints it.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { ReceiptSetup } from "@/lib/receipt";

const ReceiptContext = createContext<ReceiptSetup | null>(null);

export function ReceiptProvider({
  receipt,
  children,
}: {
  receipt: ReceiptSetup | null;
  children: ReactNode;
}) {
  return <ReceiptContext.Provider value={receipt}>{children}</ReceiptContext.Provider>;
}

export function useReceipt(): ReceiptSetup | null {
  return useContext(ReceiptContext);
}

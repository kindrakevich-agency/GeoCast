"use client";

import { createContext, useContext } from "react";
import type { ApiAdminRound } from "@/lib/api/types";

type AdminCtx = {
  rounds: ApiAdminRound[];
  refetch: () => void;
  isLoading: boolean;
  isSettled: boolean;
};

const AdminContext = createContext<AdminCtx | null>(null);

export function useAdminContext(): AdminCtx {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdminContext used outside <AdminProvider>");
  }
  return ctx;
}

export function AdminProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AdminCtx;
}) {
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

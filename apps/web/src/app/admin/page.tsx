"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminContext } from "./AdminContext";

/**
 * /admin index — auto-redirects to /admin/round/{newest} if any rounds
 * exist, otherwise shows a placeholder until the admin creates one.
 */
export default function AdminIndexPage() {
  const router = useRouter();
  const { rounds, isSettled } = useAdminContext();

  useEffect(() => {
    if (!isSettled) return;
    if (rounds.length === 0) return;
    router.replace(`/admin/round/${rounds[0].id}`);
  }, [rounds, isSettled, router]);

  return (
    <p className="text-sm text-[var(--color-text-muted)]">
      {isSettled
        ? "No rounds yet. Click + new round to create one."
        : "Loading…"}
    </p>
  );
}

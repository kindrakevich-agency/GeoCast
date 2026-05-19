// Re-export from the context module so existing `@/hooks/useAuth` imports
// keep working without touching every call site. The real implementation
// (and the AuthProvider) lives in apps/web/src/lib/auth-context.tsx.
export { useAuth } from "@/lib/auth-context";
export type { AuthValue as UseAuthResult } from "@/lib/auth-context";

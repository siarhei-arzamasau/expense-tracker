"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { authStorage } from "./auth-storage";

/**
 * Ends the session deliberately — the logout buttons and account deletion.
 *
 * Sessions end two ways and they are not the same event. This is the voluntary
 * one: discard the token, drop every cached response so the next account cannot
 * read the previous one's data, and navigate client-side.
 *
 * The involuntary one is a 401 on an authenticated request, which `api-client`
 * turns into `authStorage.expire()`; `Providers` answers that with a full
 * `window.location.replace`, because an expired token can surface from anywhere
 * — including inside a render — and a hard navigation is the only thing that
 * reliably tears down whatever was mid-flight. Do not reach for `expire()`
 * here: it would make every logout a page reload.
 */
export function useLogout(): () => void {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(() => {
    authStorage.clear();
    queryClient.clear();
    router.replace("/login");
  }, [queryClient, router]);
}

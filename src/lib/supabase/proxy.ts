import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "@/lib/supabase/config";

function copySupabaseResponse(sourceResponse: NextResponse, targetResponse: NextResponse) {
  sourceResponse.cookies.getAll().forEach((cookie) => {
    targetResponse.cookies.set(cookie);
  });

  sourceResponse.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();

    if (
      lowerKey === "content-length" ||
      lowerKey === "location" ||
      lowerKey === "set-cookie"
    ) {
      return;
    }

    targetResponse.headers.set(key, value);
  });

  return targetResponse;
}

function redirectWithSession(
  request: NextRequest,
  sourceResponse: NextResponse,
  pathname: string,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = "";

  return copySupabaseResponse(
    sourceResponse,
    NextResponse.redirect(redirectUrl),
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey } = getSupabaseConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();

  const pathname = request.nextUrl.pathname;
  const isAuthenticated = !error && Boolean(data?.claims?.sub);
  const isInventoryRootRoute = pathname === "/inventory";
  const publicInventoryRoutes = new Set([
    "/inventory/login",
    "/inventory/forgot-password",
    "/inventory/reset-password",
  ]);
  const isInventoryLoginRoute = pathname === "/inventory/login";
  const isPublicInventoryRoute =
    publicInventoryRoutes.has(pathname) ||
    /^\/inventory\/slab\/[^/]+\/view$/.test(pathname);
  const isProtectedInventoryRoute =
    (isInventoryRootRoute || pathname.startsWith("/inventory/")) &&
    !isPublicInventoryRoute;

  if (isInventoryRootRoute) {
    return redirectWithSession(
      request,
      supabaseResponse,
      isAuthenticated ? "/inventory/dashboard" : "/inventory/login",
    );
  }

  if (isInventoryLoginRoute && isAuthenticated) {
    const nextParam = request.nextUrl.searchParams.get("next");
    const safePath = nextParam?.startsWith("/inventory/") ? nextParam : "/inventory/dashboard";
    return redirectWithSession(request, supabaseResponse, safePath);
  }

  if (isProtectedInventoryRoute && !isAuthenticated) {
    return redirectWithSession(request, supabaseResponse, "/inventory/login");
  }

  return supabaseResponse;
}

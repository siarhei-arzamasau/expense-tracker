"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Tags,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";

import { ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth-storage";
import { currentUserQueryOptions } from "@/lib/queries/user";

interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navigation: NavigationItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const words = source.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

interface NavigationProps {
  pathname: string;
  onNavigate?: () => void;
}

function Navigation({ pathname, onNavigate }: NavigationProps) {
  return (
    <nav aria-label="Primary navigation" className="space-y-1">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasToken = authStorage.get() !== null;

  useEffect(() => {
    if (!hasToken) {
      router.replace("/login");
    }
  }, [hasToken, router]);

  const userQuery = useQuery({
    ...currentUserQueryOptions,
    enabled: hasToken,
  });

  useEffect(() => {
    if (userQuery.error instanceof ApiError && userQuery.error.isUnauthorized) {
      authStorage.clear();
      queryClient.clear();
      router.replace("/login");
    }
  }, [queryClient, router, userQuery.error]);

  const logout = (): void => {
    authStorage.clear();
    queryClient.clear();
    router.replace("/login");
  };

  if (!hasToken || userQuery.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <WalletCards aria-hidden className="size-5 animate-pulse" />
          Loading your workspace…
        </div>
      </main>
    );
  }

  if (userQuery.error || !userQuery.data) {
    if (userQuery.error instanceof ApiError && userQuery.error.isUnauthorized) {
      return null;
    }

    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <WalletCards aria-hidden className="text-muted-foreground size-8" />
        <div>
          <h1 className="font-semibold">Could not load your account</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {userQuery.error instanceof ApiError
              ? userQuery.error.message
              : "Check your connection and try again."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void userQuery.refetch()}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
      </main>
    );
  }

  const userLabel = userQuery.data.name?.trim() || userQuery.data.email;

  return (
    <div className="bg-muted/30 min-h-screen md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="bg-background border-border fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r p-4 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2 px-2 font-semibold tracking-tight">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <WalletCards aria-hidden className="size-4" />
          </span>
          Expense Tracker
        </Link>

        <Navigation pathname={pathname} />

        <div className="border-border mt-auto border-t pt-4">
          <div className="mb-3 flex min-w-0 items-center gap-3 px-2">
            <span
              aria-hidden
              className="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            >
              {getInitials(userQuery.data.name, userQuery.data.email)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{userLabel}</p>
              {userQuery.data.name && (
                <p className="text-muted-foreground truncate text-xs">{userQuery.data.email}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          >
            <LogOut aria-hidden className="size-4" />
            Logout
          </button>
        </div>
      </aside>

      <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <header className="bg-background border-border sticky top-0 z-40 flex h-16 items-center justify-between border-b px-4 md:hidden">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <WalletCards aria-hidden className="size-4" />
            </span>
            Expense Tracker
          </Link>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Open navigation menu"
              className="border-border rounded-md border p-2"
            >
              <Menu aria-hidden className="size-5" />
            </button>
          </Dialog.Trigger>
        </header>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 top-16 z-30 bg-black/30 md:hidden" />
          <Dialog.Content
            id="mobile-navigation"
            aria-describedby={undefined}
            className="bg-background fixed inset-y-0 top-16 right-0 z-40 flex w-72 flex-col border-l p-4 shadow-xl focus:outline-none md:hidden"
          >
            <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close navigation menu"
                className="border-border mb-4 ml-auto rounded-md border p-2"
              >
                <X aria-hidden className="size-5" />
              </button>
            </Dialog.Close>
            <Navigation pathname={pathname} onNavigate={() => setMobileMenuOpen(false)} />
            <div className="border-border mt-auto border-t pt-4">
              <div className="mb-3 flex items-center gap-3 px-2">
                <span
                  aria-hidden
                  className="bg-secondary flex size-9 items-center justify-center rounded-full text-xs font-semibold"
                >
                  {getInitials(userQuery.data.name, userQuery.data.email)}
                </span>
                <p className="min-w-0 truncate text-sm font-medium">{userLabel}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="text-muted-foreground hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium"
              >
                <LogOut aria-hidden className="size-4" />
                Logout
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="min-w-0 md:col-start-2">{children}</div>
    </div>
  );
}

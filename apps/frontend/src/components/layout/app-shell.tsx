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
import { categoriesQueryOptions } from "@/lib/queries/categories";
import {
  currentMonthSummaryQueryOptions,
  transactionsQueryOptions,
} from "@/lib/queries/transactions";
import { currentUserQueryOptions } from "@/lib/queries/user";
import { useLogout } from "@/lib/use-logout";
import { Button } from "@/components/ui/button";

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

/**
 * `[...word][0]`, not `word[0]`: string indexing addresses UTF-16 code units,
 * so a name starting with an emoji or any astral character yields half a
 * surrogate pair and renders as "�". Iterating yields whole code points.
 */
function firstCharacter(word: string): string {
  return [...word][0] ?? "";
}

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const words = source.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(firstCharacter).join("").toUpperCase();
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`focus-visible:ring-ring/70 group flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-[3px] ${className}`}
    >
      <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
        <WalletCards aria-hidden className="size-[1.125rem]" />
      </span>
      <span className="font-display text-[1.0625rem] leading-none font-bold tracking-tight">
        Expense Tracker
      </span>
    </Link>
  );
}

interface NavigationProps {
  pathname: string;
  onNavigate?: () => void;
}

/**
 * The icon badge is the active state, not a fill behind the whole row: it is
 * the same ink-filled rounded square the summary cards use for their own
 * markers, so "where you are" and "what this figure is" are told in one visual
 * language.
 */
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
            className={`focus-visible:ring-ring/70 group flex items-center gap-3 rounded-2xl py-2 pr-4 pl-2 text-sm transition-colors outline-none focus-visible:ring-[3px] ${
              active
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground font-medium"
            }`}
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground group-hover:text-foreground bg-transparent"
              }`}
            >
              <Icon aria-hidden className="size-[1.0625rem]" strokeWidth={1.75} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

interface AccountCardProps {
  name: string | null;
  email: string;
  label: string;
  onLogout: () => void;
}

/** The one dark object in the sidebar, and the only place the account lives. */
function AccountCard({ name, email, label, onLogout }: AccountCardProps) {
  return (
    <div className="bg-primary text-primary-foreground rounded-2xl p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="bg-primary-foreground/12 flex size-10 shrink-0 items-center justify-center rounded-xl text-[0.8125rem] font-semibold"
        >
          {getInitials(name, email)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{label}</p>
          {name && <p className="text-primary-foreground/60 truncate text-xs">{email}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:ring-primary-foreground/40 mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-2"
      >
        <LogOut aria-hidden className="size-4" strokeWidth={1.75} />
        Logout
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasToken = authStorage.get() !== null;

  // The only redirect this shell owns: no token means no request was ever made,
  // so nothing else can notice. A 401 on the request below is handled globally
  // — `api-client` expires the token and `Providers` navigates — and repeating
  // that here would just race it.
  useEffect(() => {
    if (!hasToken) {
      router.replace("/login");
    }
  }, [hasToken, router]);

  const userQuery = useQuery({
    ...currentUserQueryOptions,
    enabled: hasToken,
  });

  // This shell renders no children until `GET /auth/me` resolves, so nothing
  // below it could start a request of its own — which made every cold load two
  // serial round trips, the account and then the page's data. Prefetching here
  // overlaps them without touching what the gate renders: account content still
  // waits for the user, but what it is about to ask for is already in flight.
  //
  // These three cover `/`, `/transactions` (unfiltered, page 1) and
  // `/categories`. `/profile` reads none of them and pays for the requests; that
  // was the accepted trade for the route people actually land on.
  useEffect(() => {
    if (!hasToken) return;

    void queryClient.prefetchQuery(categoriesQueryOptions);
    void queryClient.prefetchQuery(transactionsQueryOptions({ page: 1 }));
    void queryClient.prefetchQuery(currentMonthSummaryQueryOptions());
  }, [hasToken, queryClient]);

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
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="bg-secondary flex size-14 items-center justify-center rounded-2xl">
          <WalletCards aria-hidden className="text-muted-foreground size-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Could not load your account</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {userQuery.error instanceof ApiError
              ? userQuery.error.message
              : "Check your connection and try again."}
          </p>
        </div>
        <Button type="button" onClick={() => void userQuery.refetch()}>
          Try again
        </Button>
      </main>
    );
  }

  const userLabel = userQuery.data.name?.trim() || userQuery.data.email;

  return (
    <div className="min-h-screen p-3 sm:p-4 lg:p-6">
      {/* First focusable element on every protected route. Without it a keyboard
          user crosses the wordmark, four nav links and the account card before
          reaching the page itself, on every navigation. `sr-only` until focused
          so it costs the layout nothing. */}
      <a
        href="#main-content"
        // `focus:fixed`, not `focus:absolute`: this wrapper establishes no
        // containing block, so an absolute offset resolves against the document
        // and puts the link off-screen for anyone who tabs while scrolled.
        className="bg-primary text-primary-foreground focus-visible:ring-ring/70 sr-only rounded-full px-5 py-2.5 text-sm font-medium focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus-visible:ring-[3px]"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex w-full max-w-[100rem] gap-6">
        <aside className="hidden w-[16.5rem] shrink-0 md:block">
          {/* The sticky offset and the height have to match the canvas padding
              on the wrapper, or the sidebar drifts out of alignment with the
              content panel as the page scrolls. */}
          <div className="panel sticky top-4 flex h-[calc(100vh-2rem)] flex-col p-4 lg:top-6 lg:h-[calc(100vh-3rem)]">
            <Wordmark className="mb-9 px-1 pt-3" />
            <Navigation pathname={pathname} />
            <div className="mt-auto pt-6">
              <AccountCard
                name={userQuery.data.name}
                email={userQuery.data.email}
                label={userLabel}
                onLogout={logout}
              />
            </div>
          </div>
        </aside>

        <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <header className="panel flex h-16 items-center justify-between px-4 md:hidden">
              <Wordmark />
              <Dialog.Trigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  aria-label="Open navigation menu"
                >
                  <Menu aria-hidden className="size-5" strokeWidth={1.75} />
                </Button>
              </Dialog.Trigger>
            </header>

            {/* `tabIndex={-1}` is what makes the skip link actually move focus:
                without it the browser scrolls here but leaves focus at the top,
                so the next Tab returns to the navigation the reader just left. */}
            <div
              id="main-content"
              tabIndex={-1}
              className="panel min-w-0 flex-1 focus:outline-none"
            >
              {children}
            </div>
          </div>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] md:hidden" />
            <Dialog.Content
              // No `id` here: Radix generates one, points the trigger's
              // `aria-controls` at it, and spreads caller props last — so an id of
              // our own silently wins and leaves that `aria-controls` dangling.
              aria-describedby={undefined}
              className="bg-card fixed inset-y-3 right-3 z-50 flex w-[17rem] flex-col rounded-panel p-4 shadow-panel focus:outline-none md:hidden"
            >
              <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Close navigation menu"
                  className="mb-4 ml-auto"
                >
                  <X aria-hidden className="size-5" strokeWidth={1.75} />
                </Button>
              </Dialog.Close>
              <Navigation pathname={pathname} onNavigate={() => setMobileMenuOpen(false)} />
              <div className="mt-auto pt-6">
                <AccountCard
                  name={userQuery.data.name}
                  email={userQuery.data.email}
                  label={userLabel}
                  onLogout={logout}
                />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
}

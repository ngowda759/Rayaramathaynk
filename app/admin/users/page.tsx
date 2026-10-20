"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import UserStats from "@/components/admin/users/UserStats";
import UserTable from "@/components/admin/users/UserTable";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";
import { StaffList } from "@/components/seva/staff/StaffList";
import { Bilingual } from "@/components/seva/ui/Bilingual";

import { SevaMeProvider, useSevaMe } from "@/hooks/seva/useSevaMe";
import { useAuth } from "@/hooks/useAuth";
import { SHELL } from "@/lib/seva/strings/shell";
import { STAFF_TEXT } from "@/lib/seva/strings/staff";
import { staffApi } from "@/services/seva/staff.service";
import { TempleUser } from "@/types/user";
import { userService } from "@/services/user.service";
import "@/styles/seva/tokens.css";

type Tab = "staff" | "accounts";

const TABS: { id: Tab; en: string; kn: string }[] = [
  { id: "staff", ...STAFF_TEXT.tabStaff },
  { id: "accounts", ...STAFF_TEXT.tabAccounts },
];

/** The existing account list, unchanged apart from its place as the second tab. */
function AllAccounts() {
  const [users, setUsers] = useState<TempleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await userService.getUsers();
        setUsers(data);
      } catch (error) {
        console.error("Failed to load users:", error);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search.toLowerCase();

    return users.filter((user) => {
      const name = user.name ?? "";
      const email = user.email ?? "";
      const role = user.role ?? "";

      return (
        name.toLowerCase().includes(keyword) ||
        email.toLowerCase().includes(keyword) ||
        role.toLowerCase().includes(keyword)
      );
    });
  }, [users, search]);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Temple Users"
        description="Manage temple staff and administrator accounts."
        action={
          <Link href="/admin/users/new">
            <Button className="bg-orange-600 hover:bg-orange-700">
              Add User
            </Button>
          </Link>
        }
      />

      <UserStats
        total={users.length}
        active={users.filter((u) => u.isActive).length}
        admins={
          users.filter(
            (u) =>
              u.role === "Temple Admin" ||
              u.role === "Super Admin"
          ).length
        }
        volunteers={
          users.filter((u) => u.role === "Volunteer").length
        }
      />

      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search users..."
      />

      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading users...
        </div>
      ) : (
        <UserTable users={filteredUsers} />
      )}
    </div>
  );
}

/**
 * Staff and roles (DB §13.6): for active temple admins who are not view-only and for super admins - the same check
 * as the staff routes' guard (staff.onboard, at least as Receptionist). Everyone else is told so; the server refuses
 * them anyway.
 */
function StaffAndRoles({ startOnboarding }: { startOnboarding: boolean }) {
  const { user, forgotPassword } = useAuth();
  const { me, loading, error, can, reload } = useSevaMe();
  const api = useMemo(
    () => staffApi(() => (user ? user.getIdToken() : Promise.reject(new Error("Sign in again to manage staff.")))),
    [user],
  );

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[30vh] items-center justify-center p-6">
        <Bilingual en={SHELL.loading.en} kn={SHELL.loading.kn} className="text-(--muted-foreground)" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="mx-auto flex min-h-[30vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-semibold">{error}</p>
        <Bilingual as="div" en={SHELL.loadFailed.en} kn={SHELL.loadFailed.kn} className="text-(--muted-foreground)" />
        <Button variant="seva-primary" onClick={() => void reload()}>
          {SHELL.tryAgain.en}
        </Button>
      </div>
    );
  }

  if (!me || !can("staff.onboard", { newRole: "receptionist" })) {
    return (
      <div className="mx-auto flex min-h-[30vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <Bilingual as="h2" en={STAFF_TEXT.noAccess.en} kn={STAFF_TEXT.noAccess.kn} className="font-semibold" />
        <p className="text-(--muted-foreground)">{STAFF_TEXT.noAccessHint}</p>
      </div>
    );
  }

  return <StaffList api={api} sendInvite={forgotPassword} me={me} can={can} startOnboarding={startOnboarding} />;
}

function UsersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "accounts" ? "accounts" : "staff");
  // /admin/users/new sends people here with ?onboard=1; read once, then dropped so a reload does not reopen the dialog.
  const [startOnboarding] = useState(searchParams.get("onboard") === "1");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (searchParams.get("onboard") === "1") router.replace(pathname);
  }, [searchParams, router, pathname]);

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (index + step + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Users" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-stone-100 p-1">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            id={`users-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`users-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={
              tab === t.id
                ? "rounded-lg bg-white px-4 py-2 text-left text-sm font-semibold text-stone-900 shadow-sm"
                : "rounded-lg px-4 py-2 text-left text-sm font-semibold text-stone-600 hover:text-stone-900"
            }
          >
            <Bilingual en={t.en} kn={t.kn} />
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`users-panel-${tab}`} aria-labelledby={`users-tab-${tab}`}>
        {tab === "staff" ? (
          <SevaMeProvider>
            <div className="seva">
              <StaffAndRoles startOnboarding={startOnboarding} />
            </div>
          </SevaMeProvider>
        ) : (
          <AllAccounts />
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <AdminAuthGuard requiredPermission="users">
      <UsersPageContent />
    </AdminAuthGuard>
  );
}

import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Just Friends Store" },
      { name: "description", content: "Internal admin command center for users, stores, orders, and analytics." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin — Just Friends Store" },
      { property: "og:description", content: "Internal admin command center for users, stores, orders, and analytics." },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="font-serif text-2xl">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view this area.</p>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}

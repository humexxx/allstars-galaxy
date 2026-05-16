import type { Metadata } from "next";
import { requireAdminOrRedirect } from "@/lib/services/auth-server";
import { getAllUsers } from "@/lib/services/user-service";
import { PageHeader } from "@/components/portal/page-header";
import { UsersTable } from "@/components/admin/users/users-table";

export const metadata: Metadata = {
  title: "Users | Capital Galaxy",
  description: "View and manage users",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdminOrRedirect();
  const users = await getAllUsers();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Users"
        description="Filter, promote, and impersonate users to provide support or verify behaviour."
      />
      <UsersTable users={users} currentAdminId={admin.id} />
    </section>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminCached } from "@/lib/services/auth-server";
import { getAllUsers } from "@/lib/services/user-service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export const metadata: Metadata = {
  title: "Users | Capital Galaxy",
  description: "View and manage users",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  try {
    await requireAdminCached();
  } catch {
    redirect("/portal");
  }

  const users = await getAllUsers();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          View all users and access their portfolios.
        </p>
      </header>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.fullName || "—"}
                </TableCell>
                <TableCell>{user.email || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/portal/portfolio?userId=${user.id}`}>
                      <Eye className="w-4 h-4 mr-1" />
                      Portfolio
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

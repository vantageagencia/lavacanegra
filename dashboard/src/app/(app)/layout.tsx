import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { getCurrentUser, getUserRole } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole();

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar email={user?.email ?? null} role={role} />
        <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}

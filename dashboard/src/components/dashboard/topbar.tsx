import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import type { UserRole } from "@/lib/auth-types";

interface TopbarProps {
  email: string | null;
  role: UserRole | null;
}

export function Topbar({ email, role }: TopbarProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-background/70 backdrop-blur-md px-4 md:px-6 py-3 sticky top-0 z-30">
      <MobileNav role={role} />
      <div className="ml-auto">
        <UserMenu email={email} role={role} />
      </div>
    </header>
  );
}

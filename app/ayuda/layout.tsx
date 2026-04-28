import { isAdminRole } from "@/lib/auth-shared";
import {
  getRequestMemberAccess,
  getRequestSession,
} from "@/lib/auth-server";
import AuthSessionSync from "../_components/AuthSessionSync";
import PublicLayoutFrame from "../_components/PublicLayoutFrame";

export default async function AyudaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getRequestSession();
  const member = session ? await getRequestMemberAccess() : null;
  const isAdmin = Boolean(member?.is_active && isAdminRole(member.role));

  return (
    <>
      {session ? <AuthSessionSync /> : null}
      <PublicLayoutFrame showMenu={Boolean(session)} isAdmin={isAdmin}>
        {children}
      </PublicLayoutFrame>
    </>
  );
}

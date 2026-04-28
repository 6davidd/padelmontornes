import { isAdminRole } from "@/lib/auth-shared";
import {
  getRequestMemberAccess,
  requireAuthenticatedSession,
} from "@/lib/auth-server";
import AuthSessionSync from "./AuthSessionSync";
import PrivateLayoutFrame from "./PrivateLayoutFrame";

type ProtectedRouteFrameProps = {
  children: React.ReactNode;
  pathname: string;
  headerMode?: "home" | "menu";
};

export default async function ProtectedRouteFrame({
  children,
  pathname,
  headerMode = "menu",
}: ProtectedRouteFrameProps) {
  await requireAuthenticatedSession(pathname);
  const member = await getRequestMemberAccess();
  const isAdmin = Boolean(member?.is_active && isAdminRole(member.role));

  return (
    <>
      <AuthSessionSync />
      <PrivateLayoutFrame headerMode={headerMode} isAdmin={isAdmin}>
        {children}
      </PrivateLayoutFrame>
    </>
  );
}

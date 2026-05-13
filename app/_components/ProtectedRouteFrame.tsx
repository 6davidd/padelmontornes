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
  isAdminOverride?: boolean;
};

export default async function ProtectedRouteFrame({
  children,
  pathname,
  headerMode = "menu",
  isAdminOverride,
}: ProtectedRouteFrameProps) {
  await requireAuthenticatedSession(pathname);
  const member =
    typeof isAdminOverride === "boolean" ? null : await getRequestMemberAccess();
  const isAdmin =
    typeof isAdminOverride === "boolean"
      ? isAdminOverride
      : Boolean(member?.is_active && isAdminRole(member.role));

  return (
    <>
      <AuthSessionSync />
      <PrivateLayoutFrame headerMode={headerMode} isAdmin={isAdmin}>
        {children}
      </PrivateLayoutFrame>
    </>
  );
}

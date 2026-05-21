import { cookies } from "next/headers";
import { ACCESS_COOKIE_NAME } from "@/lib/auth-shared";
import AuthSessionSync from "../_components/AuthSessionSync";
import PublicLayoutFrame from "../_components/PublicLayoutFrame";

export default async function AyudaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const hasSessionCookie = Boolean(cookieStore.get(ACCESS_COOKIE_NAME)?.value);

  return (
    <>
      {hasSessionCookie ? <AuthSessionSync /> : null}
      <PublicLayoutFrame showMenu={hasSessionCookie}>{children}</PublicLayoutFrame>
    </>
  );
}

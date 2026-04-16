import Header from "./Header";

export default function PrivateLayoutFrame({
  children,
  pathname,
  isAdmin,
}: {
  children: React.ReactNode;
  pathname: string;
  isAdmin: boolean;
}) {
  return (
    <>
      <Header
        key={pathname}
        pathname={pathname}
        showMenu={pathname !== "/"}
        isAdmin={isAdmin}
      />
      {children}
    </>
  );
}

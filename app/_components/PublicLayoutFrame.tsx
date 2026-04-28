import Header from "./Header";

export default function PublicLayoutFrame({
  children,
  showMenu = false,
  showProfileShortcut = false,
  isAdmin = false,
}: {
  children: React.ReactNode;
  showMenu?: boolean;
  showProfileShortcut?: boolean;
  isAdmin?: boolean;
}) {
  return (
    <>
      <Header
        showMenu={showMenu}
        showProfileShortcut={showProfileShortcut}
        isAdmin={isAdmin}
      />
      {children}
    </>
  );
}

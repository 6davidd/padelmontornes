import Header from "./Header";

export default function PrivateLayoutFrame({
  children,
  headerMode = "menu",
  isAdmin = false,
}: {
  children: React.ReactNode;
  headerMode?: "home" | "menu";
  isAdmin?: boolean;
}) {
  return (
    <>
      <Header
        showMenu={headerMode === "menu"}
        showProfileShortcut={headerMode === "home"}
        isAdmin={isAdmin}
      />
      {children}
    </>
  );
}

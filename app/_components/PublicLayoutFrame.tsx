import Header from "./Header";

export default function PublicLayoutFrame({
  children,
  showAuthenticatedMenu = false,
}: {
  children: React.ReactNode;
  showAuthenticatedMenu?: boolean;
}) {
  return (
    <>
      <Header showAuthenticatedMenu={showAuthenticatedMenu} />
      {children}
    </>
  );
}

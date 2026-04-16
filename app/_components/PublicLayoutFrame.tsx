import Header from "./Header";

export default function PublicLayoutFrame({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  return (
    <>
      <Header key={pathname} pathname={pathname} />
      {children}
    </>
  );
}

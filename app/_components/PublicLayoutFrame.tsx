import Header from "./Header";

export default function PublicLayoutFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}

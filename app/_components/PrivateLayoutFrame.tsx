import Header from "./Header";

export default function PrivateLayoutFrame({
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

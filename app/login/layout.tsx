import PublicLayoutFrame from "../_components/PublicLayoutFrame";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayoutFrame>{children}</PublicLayoutFrame>;
}

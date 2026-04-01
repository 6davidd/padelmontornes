export type MemberLike = {
  alias?: string | null
  full_name?: string | null
}

export function getDisplayName(member?: MemberLike | null) {
  const alias = member?.alias?.trim()
  if (alias) return alias

  const fullName = member?.full_name?.trim()
  if (!fullName) return "Socio"

  const firstName = fullName.split(/\s+/)[0]?.trim()
  return firstName || "Socio"
}
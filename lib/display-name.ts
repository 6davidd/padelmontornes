export type MemberLike = {
  alias?: string | null
  full_name?: string | null
}

export function getNameWithFirstSurname(fullName?: string | null) {
  const cleanFullName = fullName?.trim()
  if (!cleanFullName) return ""

  const parts = cleanFullName.split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return parts.join(" ")

  return parts.slice(0, -1).join(" ")
}

export function getDisplayName(member?: MemberLike | null) {
  const alias = member?.alias?.trim()
  if (alias) return alias

  const shortName = getNameWithFirstSurname(member?.full_name)
  return shortName || "Socio"
}

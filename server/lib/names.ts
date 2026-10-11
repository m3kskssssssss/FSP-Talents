/** "Анна Новикова" -> "Анна Н." until the candidate opens contacts. */
export function maskName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Кандидат";
  return parts.length === 1 ? parts[0]! : `${parts[0]} ${parts[1]![0]}.`;
}

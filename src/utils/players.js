/** Full display name from players table row */
export function playerDisplayName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.first_name
}

/** Two-letter initials from full name */
export function playerInitials(fullName) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

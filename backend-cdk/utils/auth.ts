export function isAdmin(groups?: string[]): boolean {
  return Array.isArray(groups) && groups.includes("Admin");
}

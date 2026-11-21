export function isAdminRoute(location: Pick<Location, "pathname" | "search"> = window.location): boolean {
  return location.pathname === "/admin" || new URLSearchParams(location.search).get("admin") === "1";
}

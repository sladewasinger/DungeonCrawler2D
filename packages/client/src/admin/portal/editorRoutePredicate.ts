export function isEditorRoute(
  location: Pick<Location, "pathname" | "hostname"> = window.location,
): boolean {
  return location.pathname === "/editor" && isLoopbackHost(location.hostname);
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

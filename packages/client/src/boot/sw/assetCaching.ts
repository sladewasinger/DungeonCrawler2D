const CONTENT_ADDRESSED_BUNDLE =
  /^\/assets\/.+-[A-Za-z0-9_-]{8}\.(?:css|js)$/;
const BUILD_VERSIONED_STATIC_ASSET =
  /^\/assets\/.+\.(?:json|png|ttf)$/;
const GAME_SHELL_PATHS = new Set(["/", "/index.html"]);

const EXPECTED_CONTENT_TYPES: Readonly<Record<string, readonly string[]>> = {
  ".css": ["text/css"],
  ".js": ["application/javascript", "text/javascript"],
  ".json": ["application/json"],
  ".png": ["image/png"],
  ".ttf": ["font/ttf", "application/x-font-ttf"],
};

export function isImmutableAssetUrl(url: URL): boolean {
  const isBuildVersionedStaticAsset = url.searchParams.has("build") &&
    BUILD_VERSIONED_STATIC_ASSET.test(url.pathname);
  return isBuildVersionedStaticAsset ||
    CONTENT_ADDRESSED_BUNDLE.test(url.pathname);
}

export function isImmutableAssetRequest(
  request: Request,
  origin: string,
): boolean {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === origin && isImmutableAssetUrl(url);
}

export function isGameShellNavigation(
  request: Request,
  origin: string,
): boolean {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === origin && GAME_SHELL_PATHS.has(url.pathname);
}

export function isCacheableResponse(response: Response): boolean {
  return response.ok &&
    response.status !== 206 &&
    response.type !== "opaque" &&
    response.headers.get("Vary")?.trim() !== "*";
}

export function isCacheableImmutableAssetResponse(
  request: Request,
  response: Response,
): boolean {
  if (!isCacheableResponse(response)) return false;
  const url = new URL(request.url);
  if (!isImmutableAssetUrl(url)) return false;
  const extension = getExtension(url.pathname);
  const expectedTypes = EXPECTED_CONTENT_TYPES[extension];
  if (!expectedTypes) return false;
  const contentType = response.headers.get("Content-Type");
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType !== undefined && expectedTypes.includes(mediaType);
}

function getExtension(pathname: string): string {
  const lastDot = pathname.lastIndexOf(".");
  return lastDot === -1 ? "" : pathname.slice(lastDot).toLowerCase();
}

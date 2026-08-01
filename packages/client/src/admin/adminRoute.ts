import { resolveWsUrl } from "../net/connection/url.js";
import { AdminPage } from "./adminPage.js";
import "./styles/adminTheme.css";
import "../ui/foundation/toggleSwitch.css";
export { isAdminRoute } from "./routePredicate.js";

export function startAdminRoute(): AdminPage {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root for admin page.");
  const page = new AdminPage({ root, url: resolveWsUrl(window.location) });
  page.start();
  return page;
}

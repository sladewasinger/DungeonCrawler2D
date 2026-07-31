import { button, controlFieldset, text } from "../adminPagePrimitives.js";

export interface AdminAuthenticationPanel {
  readonly root: HTMLFieldSetElement;
  readonly token: HTMLInputElement;
  readonly login: HTMLButtonElement;
  readonly logout: HTMLButtonElement;
  readonly status: HTMLElement;
  render(input: AdminAuthenticationPanelState): void;
}

export interface AdminAuthenticationPanelState {
  readonly authenticated: boolean;
  readonly status: string;
}

export function createAdminAuthenticationPanel(): AdminAuthenticationPanel {
  const root = controlFieldset("Authentication");
  root.dataset.adminAuthentication = "";
  const token = tokenInput();
  const login = button("Authenticate", "admin-login");
  login.dataset.adminLogin = "";
  const logout = button("Logout", "admin-logout");
  logout.dataset.adminLogout = "";
  const status = text("Not authenticated");
  status.dataset.adminStatus = "";
  status.setAttribute("role", "status");
  root.append(token, login, logout, status);
  const panel = { root, token, login, logout, status, render: renderPanel };
  panel.render({ authenticated: false, status: "Not authenticated" });
  return panel;
}

function tokenInput(): HTMLInputElement {
  const token = document.createElement("input");
  token.type = "password";
  token.placeholder = "ADMIN_TOKEN";
  token.autocomplete = "current-password";
  token.dataset.adminToken = "";
  return token;
}

function renderPanel(
  this: AdminAuthenticationPanel,
  input: AdminAuthenticationPanelState,
): void {
  this.root.dataset.authenticated = String(input.authenticated);
  this.token.hidden = input.authenticated;
  this.login.hidden = input.authenticated;
  this.logout.hidden = !input.authenticated;
  this.status.textContent = input.status;
}

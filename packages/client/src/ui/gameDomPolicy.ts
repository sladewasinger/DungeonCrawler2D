const TAB_STOP_SELECTOR =
  "a[href],button,input,select,textarea,[contenteditable='true'],[tabindex]";

function disableTabStops(root: ParentNode): void {
  if (root instanceof HTMLElement && root.matches(TAB_STOP_SELECTOR)) {
    root.tabIndex = -1;
  }
  for (const element of root.querySelectorAll<HTMLElement>(TAB_STOP_SELECTOR)) {
    element.tabIndex = -1;
  }
}

export function installGameDomPolicy(): void {
  document.documentElement.style.userSelect = "none";
  document.documentElement.style.webkitUserSelect = "none";
  document.addEventListener("selectstart", (event) => event.preventDefault());
  disableTabStops(document);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement) disableTabStops(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

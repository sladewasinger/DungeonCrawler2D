interface FallbackElement extends Record<string, unknown> {
  children: FallbackElement[];
  append(...children: FallbackElement[]): void;
  setAttribute?: (name: string, value: string) => void;
  __hudSelectors: Set<string>;
  querySelector<T extends Element>(selector: string): T | null;
  querySelectorAll<T extends Element>(selector: string): T[];
}

const node = (tag: string, ...selectors: string[]): FallbackElement => {
  const element = fallbackElement(tag);
  element.__hudSelectors = new Set(selectors);
  return element;
};

const append = (parent: FallbackElement, ...children: FallbackElement[]): void => {
  parent.append(...children);
};

export const fallbackTemplate = (id: string): FallbackElement => {
  const element = fallbackElement("div");
  const factory = FALLBACK_FACTORIES[id] ?? genericTemplate;
  factory(element);
  return element;
};

const genericTemplate = (element: FallbackElement): void => {
  element.type = "button";
};

const compassTemplate = (element: FallbackElement): void => {
  element.__hudSelectors.add("[data-hud-compass]");
  const dial = node("div", "[data-hud-compass-dial]");
  const letters = ["N", "E", "S", "W"].map((label) =>
    node("span", `[data-compass-letter="${label}"]`));
  append(dial, node("span"), ...letters, node("span", "[data-hud-compass-stairway]"));
  append(element, dial);
};

const downedTemplate = (element: FallbackElement): void => {
  const content = node("div");
  const track = node("div");
  const fill = node("div", "[data-hud-downed-fill]");
  const button = node("button", "[data-hud-downed-give-up]");
  button.type = "button";
  append(track, fill);
  append(content, node("div", "[data-hud-downed-headline]"), node("div", "[data-hud-downed-copy]"), track, button);
  append(element, content);
};

const noticesTemplate = (element: FallbackElement): void => {
  const boss = node("div", "[data-hud-notice-boss]");
  append(boss, node("div", "[data-hud-notice-boss-fill]"), node("div", "[data-hud-notice-boss-label]"));
  append(element, boss, node("div", "[data-hud-notice-toast]"), node("div", "[data-hud-notice-prompt]"), node("div", "[data-hud-notice-reconnect]"));
};

const partyTemplate = (element: FallbackElement): void => {
  const button = node("button", "[data-hud-party-invites-button]");
  button.type = "button";
  append(element, node("div", "[data-hud-party-title]"), button, node("div", "[data-hud-party-invites]"), node("div", "[data-hud-party-members]"));
};

const actionTemplate = (element: FallbackElement): void => {
  append(element, node("span", "[data-hud-party-action-label]"), node("div", "[data-hud-party-action-buttons]"));
};

const memberTemplate = (element: FallbackElement): void => {
  element.__hudSelectors.add("[data-hud-party-member]");
};

const tutorialTemplate = (element: FallbackElement): void => {
  element.setAttribute?.("role", "status");
  element.setAttribute?.("aria-live", "polite");
  element.setAttribute?.("aria-atomic", "true");
};

const inviteTemplate = (element: FallbackElement): void => {
  const buttons = node("div");
  const accept = node("button", "[data-hud-party-accept]");
  const decline = node("button", "[data-hud-party-decline]");
  accept.type = "button";
  decline.type = "button";
  append(buttons, accept, decline);
  append(element, node("span", "[data-hud-party-invite-message]"), buttons);
};

const FALLBACK_FACTORIES: Record<string, (element: FallbackElement) => void> = {
  "hud-compass-template": compassTemplate,
  "hud-downed-template": downedTemplate,
  "hud-notices-template": noticesTemplate,
  "hud-party-tracker-template": partyTemplate,
  "hud-party-action-row-template": actionTemplate,
  "hud-party-invite-template": inviteTemplate,
  "hud-party-member-row-template": memberTemplate,
  "hud-tutorial-template": tutorialTemplate,
};

const fallbackElement = (tag: string): FallbackElement => {
  const element = document.createElement(tag) as unknown as FallbackElement;
  element.children ??= [];
  element.dataset ??= {};
  element.classList ??= { add() {}, remove() {}, contains() { return false; } };
  element.__hudSelectors ??= new Set();
  const originalAppend = typeof element.append === "function" ? element.append.bind(element) : undefined;
  element.append = (...children: FallbackElement[]) => {
    if (originalAppend) originalAppend(...children);
    else element.children.push(...children);
  };
  element.querySelector = <T extends Element>(selector: string): T | null => {
    if (element.__hudSelectors.has(selector)) return element as unknown as T;
    for (const child of element.children) {
      const match = child.querySelector<T>(selector);
      if (match) return match;
    }
    return null;
  };
  element.querySelectorAll = <T extends Element>(selector: string): T[] => {
    const match = element.querySelector<T>(selector);
    return match ? [match, ...element.children.flatMap((child) => child.querySelectorAll<T>(selector))] : [];
  };
  return element;
};

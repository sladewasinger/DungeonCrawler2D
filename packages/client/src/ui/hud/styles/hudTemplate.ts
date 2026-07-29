import coreMarkup from "../templates/core.html?raw";
import feedbackMarkup from "../templates/feedback.html?raw";
import inventoryMarkup from "../templates/inventory.html?raw";
import panelsMarkup from "../templates/panels.html?raw";
import sessionMarkup from "../templates/session.html?raw";
import socialMarkup from "../templates/social.html?raw";
import touchMarkup from "../templates/touch.html?raw";
import "../../hud.css";
import { fallbackTemplate } from "./hudTemplateFallback.js";

let templates: DocumentFragment | null = null;

const MARKUP = [
  coreMarkup,
  feedbackMarkup,
  inventoryMarkup,
  panelsMarkup,
  sessionMarkup,
  socialMarkup,
  touchMarkup,
].join("\n");

const templateDocument = (): DocumentFragment | null => {
  if (templates) return templates;
  const source = document.createElement("template");
  if (!("content" in source) || !source.content?.querySelector) return null;
  source.innerHTML = MARKUP;
  templates = source.content;
  validateTemplateIds(templates);
  return templates;
};

function validateTemplateIds(documentFragment: DocumentFragment): void {
  const ids = [...documentFragment.querySelectorAll("template")]
    .map((template) => template.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate HUD template id: ${duplicates[0]}`);
  }
}

export const createHudTemplate = <T extends HTMLElement>(id: string): T => {
  const documentFragment = templateDocument();
  if (!documentFragment) return fallbackTemplate(id) as unknown as T;
  const template = documentFragment.querySelector<HTMLTemplateElement>(
    `#${id}`,
  );
  const element = template?.content.firstElementChild?.cloneNode(true);
  if (!isHtmlElement(element)) {
    throw new Error(`Missing HUD template: ${id}`);
  }
  return element as T;
};

const isHtmlElement = (value: unknown): value is HTMLElement =>
  typeof value === "object" && value !== null &&
  (typeof HTMLElement === "undefined" || value instanceof HTMLElement);

export const requireHudElement = <T extends Element>(
  root: ParentNode,
  selector: string,
): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing HUD template element: ${selector}`);
  return element;
};

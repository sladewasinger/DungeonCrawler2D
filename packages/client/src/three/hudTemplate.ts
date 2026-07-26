import markup from "./hud.html?raw";
import "./hud.css";

let templates: DocumentFragment | null = null;

const templateDocument = (): DocumentFragment => {
  if (templates) return templates;
  const source = document.createElement("template");
  source.innerHTML = markup;
  templates = source.content;
  return templates;
};

export const createHudTemplate = <T extends HTMLElement>(id: string): T => {
  const template = templateDocument().querySelector<HTMLTemplateElement>(
    `#${id}`,
  );
  const element = template?.content.firstElementChild?.cloneNode(true);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing HUD template: ${id}`);
  }
  return element as T;
};

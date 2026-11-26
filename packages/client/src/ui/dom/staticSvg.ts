/** Safe static SVG XML parser isolating DOMParser away from innerHTML sinks. */
const SVG_NS = "http://www.w3.org/2000/svg";

function withSvgNamespace(markup: string): string {
  return /\bxmlns=/.test(markup) ? markup : markup.replace("<svg", `<svg xmlns="${SVG_NS}"`);
}

export function parseStaticSvg(svgMarkup: string): SVGElement {
  const doc = new DOMParser().parseFromString(withSvgNamespace(svgMarkup), "image/svg+xml");
  const svg = doc.documentElement;
  if (doc.querySelector("parsererror") || !(svg instanceof SVGElement)) {
    throw new Error("Invalid static SVG markup passed to parseStaticSvg");
  }
  return document.importNode(svg, true);
}

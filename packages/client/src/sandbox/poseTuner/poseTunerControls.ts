/** Lightweight DOM widget builders for the Sandbox Pose Tuner drawer. */

export function ptNode<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function makeActionBtn(label: string, variant: "default" | "save" | "warn", onClick: () => void): HTMLButtonElement {
  const extra = variant === "save" ? " pt-btn-save" : variant === "warn" ? " pt-btn-warn" : "";
  const btn = ptNode("button", `pt-btn${extra}`, label);
  btn.type = "button";
  btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

export function makePillGroup<T extends string | number>(opts: {
  readonly label: string;
  readonly items: readonly { readonly id: T; readonly label: string }[];
  readonly active: T;
  readonly onSelect: (id: T) => void;
}): HTMLDivElement {
  const wrap = ptNode("div");
  wrap.append(ptNode("div", "pt-lbl", opts.label));
  const pills = ptNode("div", "pt-pills");
  for (const item of opts.items) {
    const btn = makeActionBtn(item.label, "default", () => opts.onSelect(item.id));
    btn.dataset.active = String(item.id === opts.active);
    pills.append(btn);
  }
  wrap.append(pills);
  return wrap;
}

function fmtSliderVal(v: number, step: number): string {
  return step >= 0.1 ? v.toFixed(1) : v.toFixed(2);
}

export function makeSliderRow(opts: {
  readonly label: string; readonly min: number; readonly max: number; readonly step: number;
  readonly value: number; readonly onChange: (v: number) => void;
}): HTMLDivElement {
  const row = ptNode("div", "pt-slider-row");
  const valEl = ptNode("span", "pt-val", fmtSliderVal(opts.value, opts.step));
  const input = ptNode("input");
  input.type = "range";
  input.min = String(opts.min);
  input.max = String(opts.max);
  input.step = String(opts.step);
  input.value = String(opts.value);
  input.addEventListener("input", () => {
    const v = Number(input.value);
    valEl.textContent = fmtSliderVal(v, opts.step);
    opts.onChange(v);
  });
  row.append(ptNode("span", undefined, opts.label), input, valEl);
  return row;
}

export function makeCheckRow(opts: {
  readonly label: string; readonly checked: boolean; readonly onChange: (checked: boolean) => void;
}): HTMLLabelElement {
  const lbl = ptNode("label", "pt-check");
  const cb = ptNode("input");
  cb.type = "checkbox";
  cb.checked = opts.checked;
  cb.addEventListener("change", () => opts.onChange(cb.checked));
  lbl.append(cb, ptNode("span", undefined, opts.label));
  return lbl;
}

export function isolateDrawerEvents(el: HTMLElement): void {
  const stop = (e: Event): void => e.stopPropagation();
  el.addEventListener("pointerdown", stop);
  el.addEventListener("mousedown", stop);
  el.addEventListener("wheel", stop, { passive: true });
  el.addEventListener("keydown", stop);
  el.addEventListener("keyup", stop);
}

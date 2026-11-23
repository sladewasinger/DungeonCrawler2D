/** Pure UI row & section builders for the unified Settings modal. */

export function makeNode<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function makePillBtn(label: string, onClick: () => void, extraCls = ""): HTMLButtonElement {
  const b = makeNode("button", extraCls ? `ow-pill ${extraCls}` : "ow-pill");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

export function makeSection(titleText: string): HTMLDivElement {
  const sec = makeNode("div", "ow-settings-section");
  const title = makeNode("div", "ow-settings-sec-title");
  title.textContent = titleText;
  sec.append(title);
  return sec;
}

export function makeToggleRow(label: string, initial: boolean, onToggle: (next: boolean) => void): {
  readonly row: HTMLDivElement;
  readonly btn: HTMLButtonElement;
  readonly setVal: (val: boolean) => void;
} {
  let state = initial;
  const row = makeNode("div", "ow-settings-row");
  const lbl = makeNode("span", "");
  lbl.textContent = label;
  const btn = makePillBtn(state ? "On" : "Off", () => {
    state = !state;
    applyState();
    onToggle(state);
  });
  const applyState = (): void => {
    btn.dataset.active = String(state);
    btn.textContent = state ? "On" : "Off";
  };
  applyState();
  row.append(lbl, btn);
  return { row, btn, setVal: (val: boolean) => { state = val; applyState(); } };
}

export function makeSliderRow(label: string, initial: number, onInput: (val: number) => void): {
  readonly row: HTMLDivElement;
  readonly sync: (val: number) => void;
} {
  const row = makeNode("div", "ow-audio-row");
  const head = makeNode("div", "ow-audio-row-head");
  const name = makeNode("span", "");
  name.textContent = label;
  const pct = makeNode("span", "ow-audio-pct");
  head.append(name, pct);
  const slider = makeNode("input", "ow-slider");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.05";
  const apply = (val: number): void => {
    slider.value = val.toFixed(2);
    pct.textContent = `${Math.round(val * 100)}%`;
  };
  apply(initial);
  slider.addEventListener("input", () => {
    const v = Number(slider.value);
    pct.textContent = `${Math.round(v * 100)}%`;
    onInput(v);
  });
  row.append(head, slider);
  return { row, sync: apply };
}

export function makeChoiceRow<T extends string>(opts: {
  readonly label: string;
  readonly choices: readonly { readonly id: T; readonly label: string }[];
  readonly activeId: T;
  readonly onSelect: (id: T) => void;
}): { readonly row: HTMLDivElement; readonly setActive: (id: T) => void } {
  const row = makeNode("div", "ow-settings-row");
  const lbl = makeNode("span", "");
  lbl.textContent = opts.label;
  const group = makeNode("div", "ow-settings-actions");
  const buttons = opts.choices.map((entry) => {
    const b = makePillBtn(entry.label, () => {
      setActive(entry.id);
      opts.onSelect(entry.id);
    });
    group.append(b);
    return b;
  });
  const setActive = (id: T): void => {
    for (let i = 0; i < buttons.length; i++) {
      buttons[i]!.dataset.active = String(opts.choices[i]!.id === id);
    }
  };
  setActive(opts.activeId);
  row.append(lbl, group);
  return { row, setActive };
}
/** Exercises the actual 2D party widget reconnect row rather than only its text helper. */
import { afterEach, describe, expect, it, vi } from "vitest";

import { WidgetRegistry } from "../../registry.js";

import { PartyFramesWidget } from "./partyFrames.js";


function visual() {
  return {
    visible: false,
    width: 0,
    text: "",
    setOrigin() { return this;

},
    setStrokeStyle() { return this;

},
    setVisible(value: boolean) { this.visible = value;

return this;

},
    setScrollFactor() { return this;

},
    setDepth() { return this;

},
    setPosition() { return this;

},
    setScale() { return this;

},
    setFillStyle() { return this;

},
    setText(value: string) { this.text = value;

return this;

},
    add() { return this;

},
  };

}

function scene() {
  return {
    add: {
      rectangle: () => visual(),
      text: () => visual(),
      container: () => visual(),
    },
  };

}

describe("PartyFramesWidget", () => {
  it("shows and clears the disconnected state on its rendered row", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const widget = new PartyFramesWidget(scene() as never, new WidgetRegistry(), { width: 800, height: 600 });

    const member = { id: "p", name: "Wren", hp: 10, maxHp: 30, downed: false, arrow: "N", distance: 3 };

    widget.update([{ ...member, disconnected: true }]);

    const row = (widget as unknown as { rows: Array<{ label: { text: string } }> }).rows[0]!;

    expect(row.label.text).toBe("Wren Disconnected");

    widget.update([{ ...member, disconnected: false }]);

    expect(row.label.text).toBe("N Wren · 3m");

  });

});


afterEach(() => vi.unstubAllGlobals());


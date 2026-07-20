import { describe, expect, it } from "vitest";
import { ChatController, type ChatPort } from "./controller.js";

/** Minimal scriptable ChatPort: records outgoing intents, lets tests append server lines. */
function makePort() {
  const sent: unknown[] = [];
  const log: Array<{ channel: string; name: string; text: string; target?: string }> = [];
  const port: ChatPort & { push(line: (typeof log)[number]): void; sent: unknown[] } = {
    chatLog: log,
    get chatSeq() {
      return seq;
    },
    chat: (channel, text, target) => sent.push({ intent: "chat", channel, text, target }),
    who: () => sent.push({ intent: "who" }),
    debugGod: () => sent.push({ intent: "god" }),
    debugTeleport: (x, y) => sent.push({ intent: "tp", x, y }),
    push(line) {
      log.push(line);
      seq++;
    },
    sent,
  };
  let seq = 0;
  return port;
}

describe("ChatController", () => {
  it("submits plain text on the active tab (global by default)", () => {
    const port = makePort();
    const controller = new ChatController(port);
    controller.submit("hello world");
    expect(port.sent).toEqual([{ intent: "chat", channel: "global", text: "hello world", target: undefined }]);
  });

  it("/r resolves against the most recent dm line in either direction", () => {
    const port = makePort();
    const controller = new ChatController(port);
    port.push({ channel: "dm", name: "Wren", text: "hi", target: "Wren" }); // received
    controller.sync();
    controller.submit("/r hey");
    port.push({ channel: "dm", name: "me", text: "later", target: "Rex" }); // sent to Rex
    controller.sync();
    controller.submit("/r sure");
    expect(port.sent).toEqual([
      { intent: "chat", channel: "dm", text: "hey", target: "Wren" },
      { intent: "chat", channel: "dm", text: "sure", target: "Rex" },
    ]);
  });

  it("dm-tab plain sends auto-target the current dm partner", () => {
    const port = makePort();
    const controller = new ChatController(port);
    port.push({ channel: "dm", name: "Wren", text: "hi", target: "Wren" });
    controller.sync();
    controller.selectTab("dm");
    controller.submit("no slash needed");
    expect(port.sent.at(-1)).toEqual({ intent: "chat", channel: "dm", text: "no slash needed", target: "Wren" });
  });

  it("unknown commands become local system lines, never sends", () => {
    const port = makePort();
    const controller = new ChatController(port);
    controller.submit("/dance");
    expect(port.sent).toEqual([]);
    const model = controller.model(4);
    expect(model.lines.at(-1)).toMatchObject({ channel: "system", text: expect.stringContaining("Unknown command") });
  });

  it("model: unread dots on inactive tabs, dm tab dim until first dm traffic", () => {
    const port = makePort();
    const controller = new ChatController(port);
    port.push({ channel: "local", name: "Wren", text: "psst" });
    controller.sync();
    let tabs = Object.fromEntries(controller.model(4).tabs.map((t) => [t.id, t]));
    expect(tabs["local"]).toMatchObject({ unread: true, active: false });
    expect(tabs["dm"]).toMatchObject({ dim: true });

    port.push({ channel: "dm", name: "Wren", text: "hi", target: "Wren" });
    controller.sync();
    tabs = Object.fromEntries(controller.model(4).tabs.map((t) => [t.id, t]));
    expect(tabs["dm"]).toMatchObject({ dim: false, unread: true });

    controller.selectTab("dm");
    tabs = Object.fromEntries(controller.model(4).tabs.map((t) => [t.id, t]));
    expect(tabs["dm"]).toMatchObject({ active: true, unread: false });
  });

  it("model lines filter to the active tab, system lines visible everywhere", () => {
    const port = makePort();
    const controller = new ChatController(port);
    port.push({ channel: "global", name: "A", text: "g1" });
    port.push({ channel: "local", name: "B", text: "l1" });
    port.push({ channel: "system", name: "system", text: "sys" });
    controller.sync();
    expect(controller.model(4).lines.map((l) => l.text)).toEqual(["g1", "sys"]);
    controller.selectTab("local");
    expect(controller.model(4).lines.map((l) => l.text)).toEqual(["l1", "sys"]);
  });
});

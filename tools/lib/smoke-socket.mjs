import { WebSocket } from "ws";

export function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then((value) => resolveTimedPromise(timer, resolve, value), (error) => rejectTimedPromise(timer, reject, error));
  });
}

function resolveTimedPromise(timer, resolve, value) {
  clearTimeout(timer);
  resolve(value);
}

function rejectTimedPromise(timer, reject, error) {
  clearTimeout(timer);
  reject(error);
}

export function waitForWelcome(ws, options) {
  return new Promise((resolve, reject) => {
    ws.once("open", () => sendHello(ws, options));
    ws.once("error", reject);
    ws.on("message", welcomeListener(ws, resolve, reject));
  });
}

function sendHello(ws, options) {
  ws.send(JSON.stringify({ type: "hello", ...options, clientId: `smoke-${options.name}-${Date.now().toString(36)}` }));
}

function welcomeListener(ws, resolve, reject) {
  const onMessage = (raw) => handleWelcomeMessage({ ws, raw, resolve, reject, onMessage });
  return onMessage;
}

function handleWelcomeMessage(options) {
  const message = safeParse(options.raw);
  if (message?.type === "error") rejectWelcome(options, message);
  if (message?.type === "welcome") resolveWelcome(options, message);
}

function rejectWelcome(options, message) {
  options.ws.off("message", options.onMessage);
  options.reject(new Error(`server rejected hello: ${message.code} ${message.message}`));
}

function resolveWelcome(options, message) {
  options.ws.off("message", options.onMessage);
  options.resolve(message);
}

export async function joinSocket(target, options) {
  const ws = new WebSocket(target);
  const welcome = await withTimeout(waitForWelcome(ws, options), options.handshakeTimeout, `${options.name} handshake`);
  return { ws, welcome };
}

export function waitForSnapshots(ws, count) {
  let seen = 0;
  return waitForSnapshotWhere(ws, () => ++seen >= count).then(() => seen);
}

export function waitForChatLine(ws, text) {
  return waitForSnapshotWhere(ws, (message) =>
    message.events?.some((event) => event.t === "chat" && event.channel === "global" && event.text === text));
}

function waitForSnapshotWhere(ws, predicate) {
  return new Promise((resolve, reject) => {
    ws.once("error", reject);
    const onMessage = (raw) => {
      const message = safeParse(raw);
      if (message?.type !== "snapshot" || !predicate(message)) return;
      ws.off("message", onMessage);
      resolve(message);
    };
    ws.on("message", onMessage);
  });
}

export function sendGlobalChat(ws, text) {
  ws.send(JSON.stringify({ type: "chat", channel: "global", text }));
}

export async function sendInputIntents(ws, options) {
  for (let seq = 1; seq <= options.count; seq++) {
    ws.send(JSON.stringify({ type: "input", seq, moveX: 1, moveY: 0, jump: seq % 2 === 0 }));
    await new Promise((resolve) => setTimeout(resolve, options.interval));
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

import { LEVEL, type LevelId } from "@dc2d/engine";

type StartGame = (level: LevelId, name: string) => void;

export class TitleScreen {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("div");
  private readonly nameInput = document.createElement("input");
  private readonly buttons: HTMLButtonElement[] = [];

  constructor(initialName: string, private readonly startGame: StartGame) {
    this.root.id = "title-screen";
    Object.assign(this.root.style, {
      position: "fixed",
      inset: "0",
      zIndex: "50",
      display: "grid",
      placeItems: "center",
      color: "#e8e4f0",
      background: "radial-gradient(circle at 50% 20%, #2a3440 0%, #11101c 48%, #07060b 100%)",
      fontFamily: "monospace",
    });
    const panel = document.createElement("div");
    Object.assign(panel.style, {
      width: "min(520px, calc(100vw - 48px))",
      padding: "44px",
      border: "1px solid #9fe8c9",
      background: "#0d0a12e8",
      boxShadow: "0 24px 80px #000b",
      textAlign: "center",
    });
    const title = document.createElement("h1");
    title.textContent = "DUNGEON CRAWLER";
    Object.assign(title.style, { margin: "0", color: "#ffe9b0", fontSize: "36px", letterSpacing: "4px" });
    const subtitle = document.createElement("p");
    subtitle.textContent = "Choose where to begin";
    Object.assign(subtitle.style, { color: "#9fe8c9", margin: "14px 0 28px" });
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Crawler name";
    nameLabel.htmlFor = "title-name";
    Object.assign(nameLabel.style, { display: "block", textAlign: "left", marginBottom: "7px", color: "#c8ecf7" });
    this.nameInput.id = "title-name";
    this.nameInput.value = initialName;
    this.nameInput.maxLength = 16;
    Object.assign(this.nameInput.style, {
      boxSizing: "border-box",
      width: "100%",
      marginBottom: "18px",
      padding: "11px 12px",
      border: "1px solid #5c5470",
      background: "#171421",
      color: "#e8e4f0",
      font: "inherit",
    });
    const choices = document.createElement("div");
    Object.assign(choices.style, { display: "grid", gap: "12px" });
    choices.append(
      this.choice(
        LEVEL.Dungeon,
        "Enter the Dungeon",
        "Procedural world · enemies · distant spawns",
        "#9fe8c9",
      ),
      this.choice(
        LEVEL.Sandbox,
        "Traversal Sandbox",
        "Fixed platforms · stairs · long stair flight · no enemies",
        "#ffe9b0",
      ),
    );
    Object.assign(this.status.style, { minHeight: "20px", marginTop: "20px", color: "#c8ecf7" });
    panel.append(title, subtitle, nameLabel, this.nameInput, choices, this.status);
    this.root.append(panel);
    document.body.append(this.root);
  }

  hide(): void {
    this.root.remove();
  }

  private choice(level: LevelId, title: string, detail: string, color: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.level = level;
    Object.assign(button.style, {
      padding: "15px 18px",
      border: `1px solid ${color}`,
      background: "#171421",
      color,
      cursor: "pointer",
      font: "inherit",
      textAlign: "left",
    });
    const heading = document.createElement("strong");
    heading.textContent = title;
    heading.style.display = "block";
    const description = document.createElement("span");
    description.textContent = detail;
    Object.assign(description.style, { display: "block", color: "#c8c3d4", fontSize: "12px", marginTop: "6px" });
    button.append(heading, description);
    button.addEventListener("click", () => {
      const name = this.nameInput.value.trim();
      if (name.length === 0) {
        this.status.textContent = "Enter a crawler name first.";
        this.nameInput.focus();
        return;
      }
      for (const choice of this.buttons) choice.disabled = true;
      this.nameInput.disabled = true;
      this.status.textContent = `Loading ${title.toLowerCase()}…`;
      this.startGame(level, name);
    });
    this.buttons.push(button);
    return button;
  }
}

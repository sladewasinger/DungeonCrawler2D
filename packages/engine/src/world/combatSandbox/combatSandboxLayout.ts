import combatSandboxLayout from "./combatSandboxLayout.json" with { type: "json" };

export interface CombatSandboxPoint {
  readonly x: number;
  readonly y: number;
}

export interface CombatSandboxFacingPoint extends CombatSandboxPoint {
  readonly facing: CombatSandboxPoint;
}

export interface CombatSandboxFixtureRow extends CombatSandboxPoint {
  readonly spacing: number;
  readonly columns: number;
  readonly rowSpacing: number;
}

export interface CombatSandboxLayout {
  readonly arena: {
    readonly origin: CombatSandboxPoint;
    readonly width: number;
    readonly height: number;
    readonly wallHeight: number;
  };
  readonly playerSpawn: CombatSandboxPoint;
  readonly fixtureReseedSeconds: number;
  readonly blocks: readonly (CombatSandboxPoint & { readonly height: number })[];
  readonly fixtureRows: {
    readonly weapons: CombatSandboxFixtureRow;
    readonly items: CombatSandboxFixtureRow;
    readonly pets: CombatSandboxFixtureRow;
    readonly areas: CombatSandboxFixtureRow & { readonly radius: number };
  };
  readonly trainingDummies: {
    readonly passive: CombatSandboxPoint;
    readonly sword: CombatSandboxFacingPoint;
  };
}

export const COMBAT_SANDBOX_LAYOUT: CombatSandboxLayout = combatSandboxLayout;

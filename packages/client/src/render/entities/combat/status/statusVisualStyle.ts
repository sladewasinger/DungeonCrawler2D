import { hexColorToNumber } from "../../../style/hexColor.js";
import statusVisualStyle from "./statusVisualStyle.json" with { type: "json" };

export const STATUS_VISUAL_STYLE = {
  poisoned: {
    color: hexColorToNumber(
      statusVisualStyle.poisoned.color,
      "poisoned status color",
    ),
    blend: statusVisualStyle.poisoned.blend,
    gas: {
      color: hexColorToNumber(
        statusVisualStyle.poisoned.gas.color,
        "poisoned status gas color",
      ),
      alpha: statusVisualStyle.poisoned.gas.alpha,
      scale: statusVisualStyle.poisoned.gas.scale,
      lifespanMs: statusVisualStyle.poisoned.gas.lifespanMs,
      depthBias: statusVisualStyle.poisoned.gas.depthBias,
    },
  },
} as const;

export const STATUS_VISUAL_BUDGETS = statusVisualStyle.budgets;

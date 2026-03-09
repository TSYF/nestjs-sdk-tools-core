import { noFloatingResultAsync } from "./rules/no-floating-result-async";
import type { Rule } from "eslint";

const plugin: { rules: Record<string, Rule.RuleModule> } = {
  rules: {
    "no-floating-result-async": noFloatingResultAsync,
  },
};

export = plugin;

import { chargeBudget, BudgetExceededError } from "../src/lib/budget.js";

// Uses a tiny override cap so this exercises the real code path without
// needing to spend real Bedrock money to hit the limit.
process.env.DAILY_BUDGET_MICRO_USD = "250";

async function main() {
  await chargeBudget(100);
  console.log("charge 1 (100/250) -> ok");
  await chargeBudget(100);
  console.log("charge 2 (200/250) -> ok");
  try {
    await chargeBudget(100);
    console.log("charge 3 (300/250) -> UNEXPECTEDLY ALLOWED");
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      console.log("charge 3 (300/250) -> correctly refused:", err.message);
    } else {
      throw err;
    }
  }
}

main().then(() => process.exit(0));

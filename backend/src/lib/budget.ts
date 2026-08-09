import { pool } from "./db.js";

export class BudgetExceededError extends Error {
  constructor(public spentMicroUsd: number, public capMicroUsd: number) {
    super(
      `daily Bedrock budget exhausted: $${(spentMicroUsd / 1_000_000).toFixed(4)} of $${(
        capMicroUsd / 1_000_000
      ).toFixed(2)} spent today`
    );
    this.name = "BudgetExceededError";
  }
}

// Default cap is deliberately below the requested $1.00/day — per-call cost
// estimates below are already padded above realistic actual cost, and this
// leaves a second margin on top for eu-west-2 pricing not being confirmed
// identical to the (US-published) rates the estimates are based on.
const DEFAULT_CAP_MICRO_USD = 900_000; // $0.90

function capMicroUsd(): number {
  const override = process.env.DAILY_BUDGET_MICRO_USD;
  return override ? Number(override) : DEFAULT_CAP_MICRO_USD;
}

/**
 * Atomically checks-and-reserves budget for one Bedrock call before it's
 * made, so a refused call never actually reaches the API — this is a
 * synchronous, in-request hard stop, not a delayed billing-alert reaction
 * (AWS Budgets/Cost Explorer data lags actual spend by hours). Uses
 * SELECT...FOR UPDATE to stay correct under concurrent Lambda invocations
 * (no reserved concurrency cap is available on this account, so concurrent
 * requests are a real possibility, not a hypothetical).
 */
export async function chargeBudget(estimatedMicroUsd: number): Promise<void> {
  const cap = capMicroUsd();
  const dateKey = new Date().toISOString().slice(0, 10); // UTC calendar day

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO daily_budget (date_key, spent_micro_usd) VALUES ($1, 0) ON CONFLICT (date_key) DO NOTHING`,
      [dateKey]
    );
    const { rows } = await client.query(
      `SELECT spent_micro_usd FROM daily_budget WHERE date_key = $1 FOR UPDATE`,
      [dateKey]
    );
    const spent = rows[0].spent_micro_usd as number;

    if (spent + estimatedMicroUsd > cap) {
      await client.query("COMMIT"); // nothing to persist, just release the row lock
      throw new BudgetExceededError(spent, cap);
    }

    await client.query(`UPDATE daily_budget SET spent_micro_usd = spent_micro_usd + $2 WHERE date_key = $1`, [
      dateKey,
      estimatedMicroUsd,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    if (!(err instanceof BudgetExceededError)) await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

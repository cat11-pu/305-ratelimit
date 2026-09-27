import assert from "node:assert";
import { refill, settle } from "../bucket.js";
import { step, close } from "../limitrun.js";
import { render } from "../app.js";

const base = {
  budget: 1, capacity: 2, refill_every: 5,
  state: { tokens: 2, last_at: 0, admitted: [], rejected: [], next_seq: 1, ledger: [], applied: [] },
  events: [{ id: 1, kind: "borrow", at: 1, cost: 1 }],
  backwards_error_code: "E_TIME_BACKWARDS", cost_error_code: "E_BAD_COST",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("refill returns a bucket", () => {
  assert.strictEqual(typeof refill(1, 0, 9, 2, 5).tokens, "number");
});

check("settle returns a state", () => {
  assert.strictEqual(typeof settle(base.state, 1, 1, 2, 5), "object");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);

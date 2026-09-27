// limitrun.js：按处理预算处理并留账
import { refill, settle } from "./bucket.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function codesOf(spec) {
  const s = spec || {};
  return {
    backwards: s.backwards_error_code || "E_TIME_BACKWARDS",
    cost: s.cost_error_code || "E_BAD_COST",
    event: s.event_error_code || "E_BAD_EVENT"
  };
}

function normalizeState(raw) {
  const s = raw || {};
  return {
    tokens: typeof s.tokens === "number" ? s.tokens : 0,
    last_at: typeof s.last_at === "number" ? s.last_at : 0,
    admitted: Array.isArray(s.admitted) ? s.admitted.slice() : [],
    rejected: Array.isArray(s.rejected) ? s.rejected.slice() : [],
    next_seq: typeof s.next_seq === "number" ? s.next_seq : 1,
    ledger: Array.isArray(s.ledger)
      ? s.ledger.map(function (row) { return Array.isArray(row) ? row.slice() : row; })
      : [],
    applied: Array.isArray(s.applied) ? s.applied.slice() : []
  };
}

function keyOf(event) {
  if (event && (typeof event.id === "number" || typeof event.id === "string")) return event.id;
  return "row:" + JSON.stringify([event && event.kind, event && event.at, event && event.cost]);
}

function toRow(event) {
  return [
    event.kind === undefined ? "borrow" : event.kind,
    event.id === undefined ? null : event.id,
    event.at,
    event.cost
  ];
}

function fromRow(row) {
  return { kind: row[0], id: row[1], at: row[2], cost: row[3] };
}

function validateEvent(event, codes) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw fail(codes.event, "事件结构不合法");
  }
  if (typeof event.at !== "number" || !Number.isFinite(event.at)) {
    throw fail(codes.event, "事件缺少合法时刻");
  }
  if (typeof event.cost !== "number" || !Number.isFinite(event.cost)) {
    throw fail(codes.event, "事件缺少合法代价");
  }
}

export function step(spec) {
  const codes = codesOf(spec);
  const state = normalizeState(spec && spec.state);
  const capacity = spec.capacity;
  const refillEvery = spec.refill_every;
  const budget = Math.max(0, Math.floor(Number(spec.budget) || 0));
  if (spec.events != null && !Array.isArray(spec.events)) {
    throw fail(codes.event, "事件列表不合法");
  }
  const events = spec.events || [];

  const applied = state.applied.slice();
  const seen = new Set(applied);
  const queue = [];
  for (const row of state.ledger) queue.push(fromRow(row));
  for (const event of events) {
    if (event && typeof event === "object" && seen.has(keyOf(event))) continue;
    queue.push(event);
  }

  let current = state;
  let served = 0;
  let index = 0;
  for (; index < queue.length; index += 1) {
    if (served >= budget) break;
    const event = queue[index];
    validateEvent(event, codes);
    if (event.at < current.last_at) {
      throw fail(codes.backwards, "事件时刻 " + event.at + " 早于当前结算时刻 " + current.last_at);
    }
    if (!Number.isInteger(event.cost) || event.cost <= 0 || event.cost > capacity) {
      throw fail(codes.cost, "代价 " + event.cost + " 不是正整数或超过容量 " + capacity);
    }
    current = settle(current, event.at, event.cost, capacity, refillEvery);
    applied.push(keyOf(event));
    served += 1;
  }
  const ledger = [];
  for (; index < queue.length; index += 1) ledger.push(toRow(queue[index]));
  const nextState = Object.assign({}, current, { ledger: ledger, applied: applied });
  return {
    state: nextState,
    served: served,
    ledger_before: ledger.length,
    ledger: ledger.map(function (row) { return row.slice(); }),
    judged: served,
    judged_bound: queue.length
  };
}

export function close(spec) {
  const stepped = step(Object.assign({}, spec, { events: [], budget: Number.MAX_SAFE_INTEGER }));
  return { state: stepped.state, catchup: stepped.served };
}

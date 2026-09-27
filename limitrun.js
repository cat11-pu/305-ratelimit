// limitrun.js：按处理预算处理并留账
import { settle } from "./bucket.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function errorCodes(spec) {
  return {
    event: spec.event_error_code || "E_BAD_EVENT",
    cost: spec.cost_error_code || "E_BAD_COST",
    time: spec.backwards_error_code || "E_TIME_BACKWARDS"
  };
}

function checkEvent(event, spec) {
  const codes = errorCodes(spec);
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    fail(codes.event, "event must be an object");
  }
  if (typeof event.at !== "number" || !Number.isFinite(event.at)) {
    fail(codes.event, "event.at must be a finite number");
  }
  if (typeof event.cost !== "number" || !Number.isFinite(event.cost)) {
    fail(codes.event, "event.cost must be a number");
  }
  if (!Number.isInteger(event.cost) || event.cost <= 0 || event.cost > spec.capacity) {
    fail(codes.cost, "event.cost must be a positive integer no larger than capacity");
  }
  return codes;
}

function rowToEvent(row) {
  return { kind: row[0], id: row[1], at: row[2], cost: row[3] };
}

function eventToRow(event) {
  return [event.kind, event.id, event.at, event.cost];
}

function copyState(state) {
  return {
    tokens: state.tokens,
    last_at: state.last_at,
    admitted: (state.admitted || []).slice(),
    rejected: (state.rejected || []).slice(),
    next_seq: state.next_seq || 1,
    ledger: (state.ledger || []).slice(),
    applied: (state.applied || []).slice()
  };
}

function applyOne(state, event, spec) {
  const codes = checkEvent(event, spec);
  if (event.at < state.last_at) {
    fail(codes.time, "event.at is earlier than the last settled time");
  }
  const next = settle(state, event.at, event.cost, spec.capacity, spec.refill_every);
  next.applied = state.applied.concat([event.id]);
  next.ledger = state.ledger;
  return next;
}

export function step(spec) {
  let state = copyState(spec.state);
  const events = spec.events || [];
  let budget = Math.max(0, spec.budget || 0);
  const judgedBound = state.ledger.length + events.length;
  const queue = state.ledger.map(rowToEvent);
  events.forEach(function (event) {
    if (event && state.applied.indexOf(event.id) !== -1) return;
    queue.push(event);
  });
  const carry = [];
  let served = 0;
  queue.forEach(function (event) {
    if (budget > 0) {
      state = applyOne(state, event, spec);
      budget -= 1;
      served += 1;
    } else {
      carry.push(eventToRow(event));
    }
  });
  state.ledger = carry;
  return {
    state: state,
    served: served,
    ledger_before: carry.length,
    ledger: carry.slice(),
    judged: served,
    judged_bound: judgedBound
  };
}

export function close(spec) {
  let state = copyState(spec.state);
  const rows = state.ledger;
  state.ledger = [];
  let catchup = 0;
  rows.forEach(function (row) {
    state = applyOne(state, rowToEvent(row), spec);
    catchup += 1;
  });
  state.ledger = [];
  return { state: state, catchup: catchup };
}

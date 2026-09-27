// bucket.js：令牌桶的结算
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function refill(tokens, lastAt, at, capacity, refillEvery) {
  if (!(refillEvery > 0)) return { tokens: tokens, lastAt: lastAt };
  const elapsed = at - lastAt;
  const intervals = elapsed > 0 ? Math.floor(elapsed / refillEvery) : 0;
  if (intervals <= 0) return { tokens: tokens, lastAt: lastAt };
  return {
    tokens: Math.min(capacity, tokens + intervals),
    lastAt: lastAt + intervals * refillEvery
  };
}

export function settle(state, at, cost, capacity, refillEvery) {
  if (at < state.last_at) {
    throw fail("E_TIME_BACKWARDS", "事件时刻 " + at + " 早于上次结算时刻 " + state.last_at);
  }
  if (!Number.isInteger(cost) || cost <= 0 || cost > capacity) {
    throw fail("E_BAD_COST", "代价 " + cost + " 不是正整数或超过容量 " + capacity);
  }
  const bucket = refill(state.tokens, state.last_at, at, capacity, refillEvery);
  const admitted = state.admitted.slice();
  const rejected = state.rejected.slice();
  let tokens = bucket.tokens;
  if (tokens >= cost) {
    tokens -= cost;
    admitted.push(state.next_seq);
  } else {
    rejected.push(state.next_seq);
  }
  return Object.assign({}, state, {
    tokens: tokens,
    last_at: bucket.lastAt,
    admitted: admitted,
    rejected: rejected,
    next_seq: state.next_seq + 1
  });
}

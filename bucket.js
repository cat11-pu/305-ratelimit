// bucket.js：令牌桶的结算
export function refill(tokens, lastAt, at, capacity, refillEvery) {
  if (!Number.isFinite(refillEvery) || refillEvery <= 0 || at <= lastAt) {
    return { tokens: Math.min(tokens, capacity), lastAt: lastAt };
  }
  const steps = Math.floor((at - lastAt) / refillEvery);
  return {
    tokens: Math.min(capacity, tokens + steps),
    lastAt: lastAt + steps * refillEvery
  };
}

export function settle(state, at, cost, capacity, refillEvery) {
  const bucket = refill(state.tokens, state.last_at, at, capacity, refillEvery);
  const admitted = (state.admitted || []).slice();
  const rejected = (state.rejected || []).slice();
  const seq = state.next_seq || 1;
  let tokens = bucket.tokens;
  if (tokens >= cost) {
    tokens = tokens - cost;
    admitted.push(seq);
  } else {
    rejected.push(seq);
  }
  return {
    tokens: tokens,
    last_at: bucket.lastAt,
    admitted: admitted,
    rejected: rejected,
    next_seq: seq + 1,
    ledger: (state.ledger || []).slice(),
    applied: (state.applied || []).slice()
  };
}

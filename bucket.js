// bucket.js：令牌桶的结算（基线：一律原样返回）
export function refill(tokens, lastAt, at, capacity, refillEvery) {
  return { tokens: tokens, lastAt: lastAt };
}

export function settle(state, at, cost, capacity, refillEvery) {
  return state;
}

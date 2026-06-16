/* abi.js — ручная сборка calldata. Никаких ethers и viem: одна функция,
   один аппрув и одно событие. Селекторы посчитаны cast'ом и сверяются
   байт-в-байт скриптом verify/encode_check.mjs. */

export const SELECTORS = {
  // swapExactIn(address,address,uint256,uint256,uint256,(uint8,address,bool,uint24)[])
  swapExactIn: "0x05b094ac",
  approve: "0x095ea7b3",
  // quoteMany((address,bool)[],uint256) — вся книга одного актива за один eth_call
  quoteMany: "0x02fc6ced",
  quoteExactIn: "0x791ea9ec",
  allowance: "0xdd62ed3e",
  balanceOf: "0x70a08231",

  /* v4 адресуется не адресом пула, а ключом — пятёркой полей, чей хеш и есть
     идентификатор. Поэтому у исполнения и котировки v4 свои селекторы. */
  // swapExactIn(((address,address,uint24,int24,address),bool)[],uint256,uint256,uint256)
  swapExactInV4: "0xc6eea3a0",
  // quoteMany(((address,address,uint24,int24,address),bool)[],uint256)
  quoteManyV4: "0x7a7c46ba",
  // quotePath(((address,address,uint24,int24,address),bool)[],uint256)
  quotePathV4: "0xc37c85d4",
};

export const TOPICS = {
  // RouteExecuted(address,address,address,uint256,uint256,uint8)
  RouteExecuted: "0x6734dd1734fa4940753523aef07f22cb97def958affac167b5005432415b8196",
};

/* Все ошибки контракта: без этой таблицы кошелёк показывает
   «execution reverted» и пользователь не понимает, что произошло. */
export const ERRORS = {
  "0x7828b5cd": "VoxSlippage",        // (received, minOut)
  "0x20aae256": "PartialFill",        // (paid, wanted)
  "0x8a55c9e8": "CallbackOverdraw",   // (owed, allowed)
  "0xaa2fd925": "Expired",            // (deadline, now)
  "0x0d4eceb2": "UnsupportedVenue",   // (kind)
  "0x06250401": "AmountTooLarge",
  "0x8a8b41ec": "NotAContract",       // (target)
  "0xd92e233d": "ZeroAddress",
  "0xc37f888e": "BadHops",
  "0xdbfe92cb": "RouteMismatch",      // (got, want)
  "0xb5dfd9e5": "Reentered",
  "0x90b8ec18": "TransferFailed",
  "0x1f2a2005": "ZeroAmount",
  "0x30cd7471": "NotOwner",
  "0x8ea70c07": "FeeTooHigh",
  "0xc2221189": "UnexpectedCallback",

  /* v4 */
  "0x1d5901ae": "NoHops",
  "0x5da6a27b": "TooManyHops",        // (given)
  "0x7bdffabb": "PathBroken",         // (hopIndex)
  "0x3d70d30d": "CircularPath",
  "0xd4ece547": "HooksNotSupported",  // (hooks)
  "0x0a7287b5": "NativeNotSupported",
  "0xd555333f": "BadDelta",           // (delta)
  "0xff8f9f2d": "QuoteFailed",        // (reason)
  "0x486aa307": "PoolNotInitialized",
};

/* Human-readable text for the errors a user can actually run into. */
export const ERROR_TEXT = {
  VoxSlippage:
    "Price moved: the pool delivers less than your signed minimum. Refresh the quote or raise the tolerance.",
  PartialFill:
    "Not enough depth in the pool for the full size. The contract will not fill partially — reduce the amount.",
  Expired: "Quote expired. Refresh and sign again.",
  RouteMismatch: "The route no longer matches what the pool reports. Refresh the book.",
  TransferFailed: "The token refused the transfer — check your balance and allowance.",
  Reentered: "Reentrancy blocked.",
  PathBroken: "The route does not connect: one pool's output is not the next one's input. Refresh the book.",
  HooksNotSupported:
    "This v4 pool has a hook — third-party code in the middle of the trade. We do not execute those pools.",
  NativeNotSupported: "This pool trades native ETH; only wrapped ETH is supported.",
  PoolNotInitialized: "No such v4 pool exists on the chain.",
};

const word = (hexNoPrefix) => hexNoPrefix.padStart(64, "0");
const uint = (n) => word(BigInt(n).toString(16));
const addr = (a) => word(a.toLowerCase().replace(/^0x/, ""));
const bool = (b) => word(b ? "1" : "0");

/* ─── ERC-20 ─── */

export const encodeApprove = (spender, amount) =>
  SELECTORS.approve + addr(spender) + uint(amount);

export const encodeAllowance = (owner, spender) =>
  SELECTORS.allowance + addr(owner) + addr(spender);

export const encodeBalanceOf = (who) => SELECTORS.balanceOf + addr(who);

/* ─── VoxRouter ─── */

/**
 * Hop — статический кортеж (uint8,address,bool,uint24), поэтому элементы
 * массива лежат встык, без внутренних оффсетов.
 * Хвост: смещение массива (0xa0) -> длина -> элементы.
 */
export function encodeSwapExactIn({ tokenIn, tokenOut, amountIn, minOut, deadline, hops }) {
  let data =
    SELECTORS.swapExactIn +
    addr(tokenIn) +
    addr(tokenOut) +
    uint(amountIn) +
    uint(minOut) +
    uint(deadline) +
    uint(0xc0) + // смещение до массива: 6 статических слов
    uint(hops.length);

  for (const h of hops) {
    data += uint(h.kind) + addr(h.pool) + bool(h.zeroForOne) + uint(h.feePpm || 0);
  }
  return data;
}

/* ─── VoxRouterV4 и VoxQuoterV4 ─── */

/**
 * PoolKey — пять статических полей: (currency0, currency1, fee, tickSpacing,
 * hooks). Вместе с флагом направления Hop занимает шесть слов и лежит в
 * массиве встык, без внутренних оффсетов.
 */
const int24w = (n) => {
  const v = BigInt(n);
  return word((v < 0n ? (1n << 256n) + v : v).toString(16));
};

const hopWords = (h) =>
  addr(h.key.currency0) +
  addr(h.key.currency1) +
  uint(h.key.fee) +
  int24w(h.key.tickSpacing) +
  addr(h.key.hooks || "0x0000000000000000000000000000000000000000") +
  bool(h.zeroForOne);

/** swapExactIn(Hop[] hops, uint256 amountIn, uint256 minOut, uint256 deadline) */
export function encodeSwapExactInV4({ hops, amountIn, minOut, deadline }) {
  let data =
    SELECTORS.swapExactInV4 +
    uint(0x80) + // смещение массива: 4 статических слова в голове
    uint(amountIn) +
    uint(minOut) +
    uint(deadline) +
    uint(hops.length);
  for (const h of hops) data += hopWords(h);
  return data;
}

/** quoteMany(Leg[] legs, uint256 amountIn) — вся книга v4 за один eth_call. */
export function encodeQuoteManyV4(legs, amountIn) {
  let data = SELECTORS.quoteManyV4 + uint(0x40) + uint(amountIn) + uint(legs.length);
  for (const l of legs) data += hopWords(l);
  return data;
}

/** quotePath(Leg[] path, uint256 amountIn) → (out, paid, hopsFilled) */
export function encodeQuotePathV4(path, amountIn) {
  let data = SELECTORS.quotePathV4 + uint(0x40) + uint(amountIn) + uint(path.length);
  for (const l of path) data += hopWords(l);
  return data;
}

export function decodeQuotePathV4(hex) {
  if (!hex || hex.length < 2 + 192) return null;
  const b = hex.slice(2);
  const at = (i) => BigInt("0x" + b.slice(i * 64, (i + 1) * 64));
  return { out: at(0), paid: at(1), filled: Number(at(2)) };
}

/* ─── VoxQuoter ─── */

/**
 * quoteMany(Leg[] legs, uint256 amountIn)
 * Голова: смещение массива (0x40) и amountIn; дальше длина и элементы
 * (кортеж (address,bool) статический, лежит встык).
 */
export function encodeQuoteMany(legs, amountIn) {
  let data = SELECTORS.quoteMany + uint(0x40) + uint(amountIn) + uint(legs.length);
  for (const l of legs) data += addr(l.pool) + bool(l.zeroForOne);
  return data;
}

/** Возврат: (uint256[] outs, uint256[] paid) — два динамических массива. */
export function decodeQuoteMany(hex) {
  if (!hex || hex.length < 130) return null;
  const b = hex.slice(2);
  const at = (i) => BigInt("0x" + b.slice(i * 64, (i + 1) * 64));
  const readArr = (byteOffset) => {
    const w = byteOffset / 32;
    const len = Number(at(w));
    const out = [];
    for (let i = 0; i < len; i++) out.push(at(w + 1 + i));
    return out;
  };
  const outs = readArr(Number(at(0)));
  const paid = readArr(Number(at(1)));
  return { outs, paid };
}

/* ─── разбор события ─── */

/**
 * RouteExecuted(user indexed, tokenIn indexed, tokenOut indexed, amountIn, amountOut, venueCount)
 * Три индексированных поля — в topics, три обычных — в data.
 */
export function decodeRouteExecuted(log) {
  const t = log.topics || [];
  if (t[0] !== TOPICS.RouteExecuted || t.length < 4) return null;
  const d = (log.data || "0x").slice(2);
  if (d.length < 192) return null;
  return {
    user: "0x" + t[1].slice(26),
    tokenIn: "0x" + t[2].slice(26),
    tokenOut: "0x" + t[3].slice(26),
    amountIn: BigInt("0x" + d.slice(0, 64)),
    amountOut: BigInt("0x" + d.slice(64, 128)),
    venueCount: Number(BigInt("0x" + d.slice(128, 192))),
    txHash: log.transactionHash,
    block: parseInt(log.blockNumber, 16),
  };
}

/** Человеческий текст ошибки контракта вместо «execution reverted». */
export function decodeRevert(errData) {
  if (!errData || typeof errData !== "string" || errData.length < 10) return null;
  const sel = errData.slice(0, 10);
  const body = errData.slice(10);
  const word = (i) => BigInt("0x" + body.slice(i * 64, (i + 1) * 64));

  const name = ERRORS[sel];
  if (name) {
    const out = { name, message: ERROR_TEXT[name] || null };
    if (name === "VoxSlippage") { out.received = word(0); out.minOut = word(1); }
    if (name === "PartialFill") { out.paid = word(0); out.wanted = word(1); }
    if (name === "CallbackOverdraw") { out.owed = word(0); out.allowed = word(1); }
    if (name === "Expired") { out.deadline = word(0); out.nowTs = word(1); }
    return out;
  }

  // Error(string) — например, от самого токена
  if (sel === "0x08c379a0") {
    try {
      const len = parseInt(body.slice(64, 128), 16);
      const bytes = body.slice(128, 128 + len * 2);
      const text = decodeURIComponent(bytes.replace(/(..)/g, "%$1"));
      return { name: "Error", message: text };
    } catch {
      return { name: "Error" };
    }
  }
  return { name: "unknown", selector: sel };
}

// updated: iteration 16

// updated: iteration 17

// updated: iteration 43

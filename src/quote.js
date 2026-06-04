/* quote.js — точная котировка по одному пулу, целочисленно.
   Считаем теми же формулами, что и сам пул: для v2 — константа произведения,
   для v3 — движение sqrtPrice внутри текущего тика. */

import { rpcBatch, callItem, ethCall, SEL, decodeSqrtPrice, decodeReserves, hexToBig } from "./rpc.js";
import { TOKENS, DEFAULTS, QUOTER } from "./config.js";
import { encodeQuoteMany, decodeQuoteMany } from "./abi.js";

const Q96 = 2n ** 96n;

/* ─── v2 ─── */

export function getAmountOutV2(amountIn, reserveIn, reserveOut, feePpm = 3000n) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const inAfterFee = amountIn * (1_000_000n - feePpm);
  return (inAfterFee * reserveOut) / (reserveIn * 1_000_000n + inAfterFee);
}

/* ─── v3 (в пределах текущего тика) ─── */

function nextSqrtFromAmount0(sqrtP, liquidity, amountIn) {
  // продаём token0: цена падает
  const numerator = liquidity * Q96;
  const denom = numerator + amountIn * sqrtP;
  if (denom === 0n) return sqrtP;
  return (numerator * sqrtP) / denom;
}

function nextSqrtFromAmount1(sqrtP, liquidity, amountIn) {
  // продаём token1: цена растёт
  if (liquidity === 0n) return sqrtP;
  return sqrtP + (amountIn * Q96) / liquidity;
}

export function getAmountOutV3(amountIn, sqrtP, liquidity, zeroForOne, feePpm) {
  if (amountIn <= 0n || sqrtP <= 0n || liquidity <= 0n) return { out: 0n, nextSqrt: sqrtP };
  const inAfterFee = (amountIn * (1_000_000n - feePpm)) / 1_000_000n;

  if (zeroForOne) {
    const next = nextSqrtFromAmount0(sqrtP, liquidity, inAfterFee);
    const out = (liquidity * (sqrtP - next)) / Q96;
    return { out: out > 0n ? out : 0n, nextSqrt: next };
  }
  const next = nextSqrtFromAmount1(sqrtP, liquidity, inAfterFee);
  const num = liquidity * Q96 * (next - sqrtP);
  const out = num / (next * sqrtP);
  return { out: out > 0n ? out : 0n, nextSqrt: next };
}

/* ─── чтение состояния пула перед котировкой ─── */

export async function poolState(row) {
  // slot0() и globalState() отдают sqrtPriceX96 одним и тем же первым словом,
  // а swap() и форма колбэка у Algebra совпадают с v3 — поэтому оба вида
  // считаются и исполняются одним путём.
  const concentrated = row.kind === "v3" || row.kind === "v3a";
  const priceSel = row.priceSel || (concentrated ? "slot0" : "getReserves");

  const calls = [
    callItem(row.pool, SEL.token0),
    callItem(row.pool, SEL.token1),
    callItem(row.pool, SEL[priceSel]),
  ];
  if (concentrated) {
    calls.push(callItem(row.pool, SEL.liquidity));
    calls.push(callItem(row.pool, SEL.fee));
  }
  const res = await rpcBatch(calls);
  if (!res[0] || !res[1] || !res[2]) return null;

  const token0 = "0x" + res[0].slice(26).toLowerCase();
  const token1 = "0x" + res[1].slice(26).toLowerCase();

  if (!concentrated) {
    const [r0, r1] = decodeReserves(res[2]);
    return {
      token0, token1, kind: "v2",
      reserve0: r0, reserve1: r1,
      feePpm: BigInt(row.feePpm ?? 3000),
    };
  }
  return {
    token0, token1, kind: "v3",
    sqrtP: decodeSqrtPrice(res[2]),
    liquidity: hexToBig(res[3]),
    feePpm: res[4] ? hexToBig(res[4]) : 3000n,
  };
}

/* ─── публичная котировка ─── */

/**
 * @param row      строка книги (из engine)
 * @param amountIn BigInt в сырых единицах входного токена
 * @param tokenIn  адрес входного токена
 */
export async function quoteExactIn(row, amountIn, tokenIn, slippageBps = DEFAULTS.slippageBps) {
  const st = await poolState(row);
  if (!st) return null;

  const inIsToken0 = st.token0 === tokenIn.toLowerCase();
  if (!inIsToken0 && st.token1 !== tokenIn.toLowerCase()) return null;

  let out;
  if (st.kind === "v2") {
    const [rIn, rOut] = inIsToken0 ? [st.reserve0, st.reserve1] : [st.reserve1, st.reserve0];
    out = getAmountOutV2(amountIn, rIn, rOut, st.feePpm);
  } else {
    out = getAmountOutV3(amountIn, st.sqrtP, st.liquidity, inIsToken0, st.feePpm).out;
  }
  if (out <= 0n) return null;

  const minOut = (out * BigInt(10_000 - slippageBps)) / 10_000n;
  const tokenOut = inIsToken0 ? st.token1 : st.token0;

  return {
    pool: row.pool,
    venue: row.venue,
    kind: st.kind,
    tokenIn: tokenIn.toLowerCase(),
    tokenOut,
    zeroForOne: inIsToken0,
    feePpm: Number(st.feePpm),
    amountIn,
    expectedOut: out,
    minOut,
    slippageBps,
    hop: {
      kind: st.kind === "v2" ? 0 : 1,
      pool: row.pool,
      zeroForOne: inIsToken0,
      feePpm: st.kind === "v2" ? Number(st.feePpm) : 0,
    },
  };
}

/* ─── точная котировка: считает сам пул ─── */

/**
 * Формула внутри тика систематически завышает выход — на пуле с шагом тика 1
 * примерно на 0.16% уже на ста долларах, а площадки между собой расходятся на
 * 0.01%. То есть ранжировать их этой формулой нельзя: ошибка модели больше
 * измеряемой величины. Поэтому спрашиваем сами пулы через VoxQuoter, и вся
 * книга приходит одним eth_call.
 */
async function exactQuotes(rows, amountIn, tokenIn, slippageBps) {
  const legs = [];
  const meta = [];
  for (const r of rows) {
    const zeroForOne = r.token0 === tokenIn.toLowerCase();
    if (!zeroForOne && r.token1 !== tokenIn.toLowerCase()) continue;
    legs.push({ pool: r.pool, zeroForOne });
    meta.push({ row: r, zeroForOne });
  }
  if (!legs.length) return [];

  const raw = await ethCall(QUOTER.address, encodeQuoteMany(legs, amountIn));
  const dec = decodeQuoteMany(raw);
  if (!dec) return [];

  const quotes = [];
  for (let i = 0; i < meta.length; i++) {
    const out = dec.outs[i] ?? 0n;
    const paid = dec.paid[i] ?? 0n;
    if (out <= 0n) continue;
    // пул принял меньше, чем просили — глубины не хватает, роутер такое отклонит
    if (paid !== amountIn) continue;

    const { row, zeroForOne } = meta[i];
    quotes.push({
      pool: row.pool,
      venue: row.venue,
      kind: row.kind,
      tokenIn: tokenIn.toLowerCase(),
      tokenOut: zeroForOne ? row.token1 : row.token0,
      zeroForOne,
      feePpm: Number(row.feePpm ?? 0),
      amountIn,
      expectedOut: out,
      minOut: (out * BigInt(10_000 - slippageBps)) / 10_000n,
      slippageBps,
      exact: true,
      hop: { kind: 1, pool: row.pool, zeroForOne, feePpm: 0 },
    });
  }
  return quotes;
}

/** Лучшая котировка среди исполнимых пулов актива. */
export async function bestQuote(rows, amountIn, tokenIn, slippageBps = DEFAULTS.slippageBps) {
  const candidates = rows.filter((r) => r.executable && !r.dead);
  let quotes = [];

  if (QUOTER.address) {
    try {
      quotes = await exactQuotes(candidates, amountIn, tokenIn, slippageBps);
    } catch (e) {
      console.warn("[vox] quoter unavailable, using the model:", e.message);
    }
  }

  if (!quotes.length) {
    for (const r of candidates) {
      try {
        const q = await quoteExactIn(r, amountIn, tokenIn, slippageBps);
        if (q) quotes.push(q);
      } catch (e) {
        /* пул мог быть снят — просто пропускаем */
      }
    }
  }
  if (!quotes.length) return null;
  quotes.sort((a, b) => (b.expectedOut > a.expectedOut ? 1 : b.expectedOut < a.expectedOut ? -1 : 0));
  const best = quotes[0];
  best.alternatives = quotes.slice(1, 4);
  if (quotes.length > 1) {
    const worst = quotes[quotes.length - 1];
    best.betterThanWorstPct =
      Number(((best.expectedOut - worst.expectedOut) * 10000n) / worst.expectedOut) / 100;
  }
  return best;
}

/* ─── форматирование ─── */

export function fmtUnits(raw, decimals, digits = 4) {
  const neg = raw < 0n;
  const v = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, digits).replace(/0+$/, "");
  return (neg ? "-" : "") + whole.toLocaleString("en") + (fracStr ? "." + fracStr : "");
}

export function parseUnits(str, decimals) {
  const s = String(str).trim();
  if (!s || isNaN(Number(s))) return 0n;
  const [w, f = ""] = s.split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
}

export const decimalsOf = (sym) => TOKENS[sym]?.decimals ?? 18;

// updated: iteration 33

// updated: iteration 34

// updated: iteration 37

/* route.js — построение маршрута в обе стороны и через промежуточный токен.
 *
 * Раньше клиент умел ровно одно: USDG → акция одним пулом. Контракт при этом
 * симметричен и принимает до трёх хопов, то есть ограничение жило только здесь.
 *
 * Что делает этот модуль:
 *   • прямой маршрут в любую сторону (купить и продать);
 *   • двуххоповый через USDG или WETH, если прямого пула нет или он хуже;
 *   • выбор лучшего по фактическому выходу, а не по цене на витрине.
 *
 * Размеры берутся у самих пулов через VoxQuoter: для второго хопа нужен выход
 * первого, поэтому хопы котируются последовательно — иначе размер второго
 * пришлось бы угадывать.
 */

import { TOKENS, QUOTE_LEGS, POOL_KEYS, QUOTER, QUOTER_V4, DEFAULTS } from "./config.js";
import { ethCall } from "./rpc.js";
import { encodeQuoteMany, decodeQuoteMany, encodeQuoteManyV4 } from "./abi.js";

/**
 * Промежуточные токены, через которые вообще имеет смысл идти.
 *
 * SPY здесь не для красоты: крупнейшие пулы v4 этой цепи номинированы именно
 * в нём, а не в долларе, и без него половина книги v4 недостижима из USDG.
 */
const BRIDGES = ["USDG", "WETH", "SPY"];

/**
 * Семейство определяет, КАКОЙ контракт исполнит ногу. У v3-подобных пулов своп
 * зовётся прямо у пула, у v4 — через замок синглтона. Роутеры разные, поэтому
 * смешанный маршрут не исполнит ни один: цепочка обязана быть однородной.
 */
const familyOf = (row) => (row.kind === "v4" ? "v4" : "v3");

const ZERO = "0x0000000000000000000000000000000000000000";
const addr = (sym) => TOKENS[sym]?.addr;
const symOf = (a) => {
  const x = (a || "").toLowerCase();
  for (const [s, t] of Object.entries(TOKENS)) if (t.addr === x) return s;
  return null;
};

/* ─── какие пулы соединяют два токена ─── */

/**
 * Пулы между a и b среди строк книги. Строки приходят по активу, поэтому
 * пара USDG/WETH берётся из опорных пулов — там она уже выбрана по глубине.
 */
export function poolsBetween(rows, aSym, bSym) {
  const a = addr(aSym), b = addr(bSym);
  if (!a || !b) return [];

  const out = rows.filter((r) => {
    if (!r.executable || r.dead || !r.token0 || !r.token1) return false;
    const pair = [r.token0, r.token1];
    return pair.includes(a) && pair.includes(b);
  });

  /* Пара двух деноминаций в книге активов не встречается: строки приходят по
     выбранному активу, а USDG/SPY живёт в строках SPY. Берём её из опорных
     пулов — там для каждой деноминации уже выбран самый глубокий пул.
     Без этого мост через SPY недостижим, а именно в нём номинирована
     большая часть книги v4. */
  if (!out.length) {
    for (const [sym, leg] of Object.entries(QUOTE_LEGS || {})) {
      if (!leg?.pool) continue;
      const pairSyms = [sym, "USDG"];
      if (!pairSyms.includes(aSym) || !pairSyms.includes(bSym)) continue;

      const key = leg.kind === "v4" ? POOL_KEYS[leg.pool] || null : null;
      // пул v4 без восстановленного ключа не адресуется, с хуком — не берём
      if (leg.kind === "v4" && !(key && key.routable && key.currency0 !== ZERO)) continue;

      out.push({
        pool: leg.pool,
        poolKey: key,
        venue: sym + "/USDG",
        kind: leg.kind,
        executable: true,
        token0: null,
        token1: null,
        leg: true,
        legAddr: leg.addr,
      });
    }
  }
  return out;
}

/** Направление свопа в пуле: вход — token0? */
function zeroForOne(row, tokenIn) {
  if (row.token0) return row.token0 === tokenIn;
  // опорный пул: token0 не читали, определяем по возрастанию адреса
  const other = row.legAddr === tokenIn ? TOKENS.USDG.addr : row.legAddr;
  return BigInt(tokenIn) < BigInt(other);
}

/* ─── котировка ─── */

/** Один eth_call на список пулов одного семейства с одинаковым входом. */
async function quoteMany(legs, amountIn, family) {
  const quoter = family === "v4" ? QUOTER_V4 : QUOTER;
  if (!quoter?.address || !legs.length) return [];
  const data =
    family === "v4"
      ? encodeQuoteManyV4(legs, amountIn)
      : encodeQuoteMany(legs, amountIn);
  const raw = await ethCall(quoter.address, data);
  const dec = decodeQuoteMany(raw); // обе версии возвращают (uint256[], uint256[])
  if (!dec) return [];
  return legs.map((l, i) => ({
    ...l,
    out: dec.outs[i] ?? 0n,
    paid: dec.paid[i] ?? 0n,
  }));
}

/** Лучший пул для одного шага. Пул, который не смог принять весь вход,
    отбрасывается: роутер такую заявку всё равно откатит. */
async function bestHop(rows, fromSym, toSym, amountIn, family) {
  const pools = poolsBetween(rows, fromSym, toSym).filter(
    (r) => !family || familyOf(r) === family
  );
  if (!pools.length) return null;

  const fam = family || familyOf(pools[0]);
  const tokenIn = addr(fromSym);
  const legs = pools.map((r) => ({
    pool: r.pool,
    key: r.poolKey || null,
    zeroForOne: zeroForOne(r, tokenIn),
    row: r,
  }));
  /* Сбой квотера — это не «маршрута нет». Разница важна: первое лечится
     повтором, второе означает, что торговать нечем, и так это и выглядит на
     экране. Поэтому ошибка пробрасывается, а не превращается в пустой ответ. */
  // без ключа пул v4 не адресуется — котировать нечего
  return bestHopFiltered(fam === "v4" ? legs.filter((l) => l.key) : legs, amountIn, fam);
}

async function bestHopFiltered(legs, amountIn, fam) {
  if (!legs.length) return null;

  const quoted = await quoteMany(
    legs.map(({ pool, key, zeroForOne }) =>
      fam === "v4" ? { key, zeroForOne } : { pool, zeroForOne }
    ),
    amountIn,
    fam
  );

  const ok = quoted
    .map((q, i) => ({ ...q, row: legs[i].row, key: legs[i].key, pool: legs[i].pool, zeroForOne: legs[i].zeroForOne }))
    .filter((q) => q.out > 0n && q.paid === amountIn);
  if (!ok.length) return null;

  ok.sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0));
  const best = ok[0];
  return {
    pool: best.pool,
    key: best.key,
    family: fam,
    venue: best.row.venue,
    zeroForOne: best.zeroForOne,
    feePpm: best.row.feePpm ?? null,
    amountIn,
    out: best.out,
    alternatives: ok.slice(1, 4).map((x) => ({ venue: x.row.venue, out: x.out })),
  };
}

/* ─── маршрут целиком ─── */

/**
 * Лучший маршрут из fromSym в toSym.
 * Сначала прямой, потом через каждый промежуточный токен; выигрывает тот,
 * что даёт больше на выходе.
 */
/**
 * @param only  ограничить одним семейством ("v3" or "v4"). Нужно проверке:
 *              иначе живое исполнение в v4 не увидеть, пока v3 выигрывает торг.
 */
export async function bestRoute(
  rows, fromSym, toSym, amountIn, slippageBps = DEFAULTS.slippageBps, only = null
) {
  if (!amountIn || amountIn <= 0n || fromSym === toSym) return null;

  const FAMILIES = only ? [only] : ["v3", "v4"];

  /* Прямая нога исполнима любым семейством — берём лучшую из обоих.
     Мосты считаются отдельно по каждому семейству: цепочка обязана быть
     однородной, иначе её не исполнит ни один роутер. */
  const tasks = [];
  for (const fam of FAMILIES) {
    tasks.push(
      bestHop(rows, fromSym, toSym, amountIn, fam)
        .then((h) => (h ? { legs: [h], path: [fromSym, toSym] } : null))
        .catch(() => null)
    );
  }

  for (const mid of BRIDGES) {
    if (mid === fromSym || mid === toSym) continue;
    for (const fam of FAMILIES) {
      // до котировок отсекаем то, чего нет: это чистая проверка по книге
      if (!poolsBetween(rows, fromSym, mid).some((r) => familyOf(r) === fam)) continue;
      if (!poolsBetween(rows, mid, toSym).some((r) => familyOf(r) === fam)) continue;
      tasks.push(
        (async () => {
          const first = await bestHop(rows, fromSym, mid, amountIn, fam);
          if (!first) return null;
          const second = await bestHop(rows, mid, toSym, first.out, fam);
          if (!second) return null;
          return { legs: [first, second], path: [fromSym, mid, toSym] };
        })().catch((e) => {
          // мост не сложился — прямой маршрут это не отменяет
          console.warn("[vox] bridge via " + mid + " (" + fam + "):", e.message);
          return null;
        })
      );
    }
  }

  const candidates = (await Promise.all(tasks)).filter(Boolean);

  if (!candidates.length) return null;

  const outOf = (c) => c.legs[c.legs.length - 1].out;
  candidates.sort((a, b) => (outOf(b) > outOf(a) ? 1 : outOf(b) < outOf(a) ? -1 : 0));

  /* Лишний хоп — это вторая комиссия, второй пул, который может кончиться, и
     больше газа. Брать его стоит только ради заметной разницы, а не ради
     тысячных долей процента, которые всё равно уплывут за время подписи. */
  const MULTIHOP_EDGE_BPS = 10n; // 0.10%
  let win = candidates[0];
  if (win.legs.length > 1) {
    const direct = candidates.find((c) => c.legs.length === 1);
    if (direct && outOf(direct) > 0n) {
      const edge = ((outOf(win) - outOf(direct)) * 10_000n) / outOf(direct);
      if (edge < MULTIHOP_EDGE_BPS) win = direct;
    }
  }
  const expectedOut = win.legs[win.legs.length - 1].out;
  const worst = candidates[candidates.length - 1].legs.slice(-1)[0].out;

  const family = win.legs[0].family || "v3";

  return {
    path: win.path,
    legs: win.legs,
    family,
    /* Форма ног зависит от роутера: v3-подобным нужен адрес пула, v4 —
       ключ, потому что контракта пула у него нет. */
    hops:
      family === "v4"
        ? win.legs.map((l) => ({ key: l.key, zeroForOne: l.zeroForOne }))
        : win.legs.map((l) => ({
            kind: 1,
            pool: l.pool,
            zeroForOne: l.zeroForOne,
            feePpm: 0,
          })),
    tokenIn: addr(fromSym),
    tokenOut: addr(toSym),
    symIn: fromSym,
    symOut: toSym,
    amountIn,
    expectedOut,
    minOut: (expectedOut * BigInt(10_000 - slippageBps)) / 10_000n,
    slippageBps,
    exact: true,
    venue: win.legs.map((l) => l.venue).join(" → "),
    hopCount: win.legs.length,
    betterThanWorstPct:
      candidates.length > 1 && worst > 0n
        ? Number(((expectedOut - worst) * 10000n) / worst) / 100
        : null,
    alternatives: win.legs[0].alternatives || [],
  };
}

export { symOf };

// updated: iteration 27

// updated: iteration 35

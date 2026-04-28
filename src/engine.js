/* engine.js — движок книги.
   Пулы находим через DexScreener, а цены перепроверяем прямо в чейне.
   Индексатор может врать и отставать; резервы и slot0 — нет. */

import { CHAIN, TOKENS, VENUES, QUOTE_LEGS, POOL_FACTS, POOL_KEYS, TICKERS, LIVENESS, DEFAULTS } from "./config.js";
import { rpcBatch, callItem, SEL, decodeSqrtPrice, decodeReserves } from "./rpc.js";
import { keccak256 } from "./keccak.js";

const Q96 = 2n ** 96n;

/* ─── обнаружение пулов ─── */

async function discover(sym) {
  const token = TOKENS[sym];
  if (!token) return [];
  const res = await fetch(
    "https://api.dexscreener.com/latest/dex/search?q=" + encodeURIComponent(sym)
  );
  const j = await res.json();

  const mine = (j.pairs || []).filter(
    (p) =>
      p.chainId === "robinhood" &&
      (p.baseToken?.address || "").toLowerCase() === token.addr
  );

  return mine.map((p) => {
    const labels = (p.labels || []).join(",").toLowerCase();
    const dex = (p.dexId || "").toLowerCase();
    const isPoolId = (p.pairAddress || "").length === 66; // v4 адресуется 32-байтным id
    const labelKind = labels.includes("v4") || isPoolId
      ? "v4"
      : labels.includes("v3")
      ? "v3"
      : labels.includes("v2")
      ? "v2"
      : "v2";
    const name = dex === "uniswap" ? "Uniswap " + labelKind : dex.charAt(0).toUpperCase() + dex.slice(1);
    const venue = VENUES[name] || { kind: labelKind, executable: false };
    // Ярлык индексатора — только для имени. Вид AMM берём из реестра, который
    // canon.mjs заполнил живой пробой пулов: Up и Alandale приходят без метки
    // версии, но обе площадки концентрированные.
    const kind = venue.kind || labelKind;
    const priceSel = venue.priceSel || (kind === "v2" ? "getReserves" : "slot0");

    const liq = p.liquidity?.usd || 0;
    const vol = p.volume?.h24 || 0;
    const tx = (p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0);

    /* У v4 нет контракта пула: чтобы в нём торговать, нужен ключ — пятёрка
       полей, чей хеш и есть идентификатор. Ключи восстановлены из событий
       Initialize (verify/poolkeys.mjs). Нет ключа — пул только смотрим.
       Отсеиваются также пулы с хуком (чужой код в середине сделки),
       с плавающей ставкой и с нативным ETH: их роутер не берёт. */
    const key = isPoolId ? POOL_KEYS[p.pairAddress] || null : null;
    const keyUsable =
      !!key && key.routable && key.currency0 !== "0x0000000000000000000000000000000000000000";

    return {
      sym,
      pool: p.pairAddress,
      poolKey: key,
      venue: name,
      kind,
      priceSel,
      concentrated: kind === "v3" || kind === "v3a",
      executable: !!venue.executable && (isPoolId ? keyUsable : true),
      feePpm: venue.feePpm ?? null,
      quote: (p.quoteToken?.symbol || "").toUpperCase(),
      quoteAddr: (p.quoteToken?.address || "").toLowerCase(),
      pxReported: +p.priceUsd || 0,
      liq,
      vol24: vol,
      txns24: tx,
      alive: liq > LIVENESS.minLiq && vol > LIVENESS.minVol && tx > LIVENESS.minTx,
      // фантом: заявлены миллиарды, а торгов нет
      dead: liq > 50_000_000 && vol < 1000,
    };
  });
}

/* ─── перепроверка цен в чейне ─── */

/**
 * Цена актива, выраженная в котируемом токене, из slot0.
 *
 * sqrtPriceX96^2 / 2^192 = сколько СЫРЫХ единиц token1 за одну СЫРУЮ token0.
 * Перевод в человеческие единицы — множитель 10^(decAsset - decQuote),
 * причём он одинаков независимо от того, наш актив это token0 или token1.
 */
function quotePerAsset(sqrtX96, decAsset, decQuote, assetIsToken0) {
  if (!sqrtX96) return 0;
  const r = Number(sqrtX96) / Number(Q96);
  const priceRaw = r * r; // token1_raw за token0_raw
  if (!isFinite(priceRaw) || priceRaw === 0) return 0;
  const base = assetIsToken0 ? priceRaw : 1 / priceRaw;
  const out = base * Math.pow(10, decAsset - decQuote);
  return isFinite(out) ? out : 0;
}

/* ─── цена пула Uniswap v4 ─── */

/* У v4 нет контракта пула: всё состояние лежит в мэппинге синглтона, а «адрес»
   пула — это 32-байтный poolId. Слот структуры = keccak256(poolId ‖ 6), первое
   слово — упакованный Slot0: sqrtPriceX96 в младших 160 битах, дальше tick,
   protocolFee и lpFee. Читаем через extsload — обычный eth_call. */

const pad32 = (n) => BigInt(n).toString(16).padStart(64, "0");
const v4Slot = (poolId) => keccak256(poolId + pad32(CHAIN.v4PoolsSlot));

function decodeV4Slot0(word) {
  if (!word || word.length < 66) return null;
  const w = BigInt(word.slice(0, 66));
  const sqrtP = w & ((1n << 160n) - 1n);
  if (sqrtP === 0n) return null;
  return { sqrtP, lpFee: Number((w >> 208n) & 0xffffffn) };
}

/** Порядок токенов в v4 — по возрастанию адреса; нативный ETH это адрес 0. */
const isToken0 = (a, b) => BigInt(a) < BigInt(b);

async function verifyV4(rows) {
  const targets = rows.filter((r) => r.kind === "v4" && !r.dead && r.pool.length === 66);
  if (!targets.length || !CHAIN.v4PoolManager) return;

  const res = await rpcBatch(
    targets.map((r) => callItem(CHAIN.v4PoolManager, SEL.extsload + v4Slot(r.pool).slice(2)))
  );

  targets.forEach((r, i) => {
    const st = decodeV4Slot0(res[i]);
    if (!st) return;
    const base = TOKENS[r.sym].addr;
    const quote = r.quoteAddr || "0x0000000000000000000000000000000000000000";
    const assetIsToken0 = isToken0(base, quote);
    r.token0 = assetIsToken0 ? base : quote;
    r.token1 = assetIsToken0 ? quote : base;
    r.zeroForOne = !assetIsToken0; // вход котируемый -> выход наш актив
    r.pxQuote = quotePerAsset(
      st.sqrtP,
      TOKENS[r.sym].decimals,
      tokenDecimals(quote, r.quote),
      assetIsToken0
    );
    r.feePpm = st.lpFee;
    r.pxSource = "onchain";
  });
}

/* token0, token1 и ставка пула неизменяемы: читать их каждые 20 секунд —
   это вчетверо больше запросов на ровном месте. Меняется только состояние
   цены, за ним и ходим. */
const poolFacts = new Map();

// Часть свойств посчитана при сборке — на первом заходе их не читаем заново.
for (const [pool, f] of Object.entries(POOL_FACTS || {})) poolFacts.set(pool, f);

async function loadFacts(rows) {
  const need = rows.filter((r) => !poolFacts.has(r.pool));
  if (!need.length) return;

  const calls = [];
  for (const r of need) {
    calls.push(callItem(r.pool, SEL.token0));
    calls.push(callItem(r.pool, SEL.token1));
    calls.push(callItem(r.pool, SEL.fee));
  }
  const res = await rpcBatch(calls);

  need.forEach((r, i) => {
    const t0 = res[i * 3], t1 = res[i * 3 + 1], fee = res[i * 3 + 2];
    if (!t0 || !t1) return;
    poolFacts.set(r.pool, {
      token0: "0x" + t0.slice(26).toLowerCase(),
      token1: "0x" + t1.slice(26).toLowerCase(),
      feePpm: fee ? parseInt(fee.slice(0, 66), 16) || null : null,
    });
  });
}

async function verify(rows) {
  const targets = rows.filter((r) => !r.dead && r.priceSel && r.kind !== "v4");
  if (!targets.length) return rows;

  await loadFacts(targets);

  const priced = targets.filter((r) => poolFacts.has(r.pool));
  const res = await rpcBatch(priced.map((r) => callItem(r.pool, SEL[r.priceSel])));

  priced.forEach((r, i) => {
    const state = res[i];
    if (!state) return;

    const f = poolFacts.get(r.pool);
    r.token0 = f.token0;
    r.token1 = f.token1;
    if (f.feePpm != null) r.feePpm = f.feePpm;

    const base = TOKENS[r.sym].addr;
    r.zeroForOne = r.token1 === base; // вход = котируемый, выход = наш актив
    const decBase = TOKENS[r.sym].decimals;
    const decQuote = tokenDecimals(r.quoteAddr, r.quote);
    const assetIsToken0 = r.token0 === base;

    if (r.concentrated) {
      // slot0() и globalState() отдают sqrtPriceX96 одним и тем же первым словом
      r.pxQuote = quotePerAsset(decodeSqrtPrice(state), decBase, decQuote, assetIsToken0);
    } else {
      const [r0, r1] = decodeReserves(state);
      if (r0 > 0n && r1 > 0n) {
        const [rBase, rQuote] = assetIsToken0 ? [r0, r1] : [r1, r0];
        r.reserves = { base: rBase, quote: rQuote };
        r.pxQuote =
          (Number(rQuote) / Math.pow(10, decQuote)) / (Number(rBase) / Math.pow(10, decBase));
      }
    }
    r.pxSource = "onchain";
  });

  return rows;
}

function tokenDecimals(addr, sym) {
  for (const t of Object.values(TOKENS)) if (t.addr === addr) return t.decimals;
  if (sym === "USDG") return 6;
  return 18; // включая нативный ETH (адрес 0) и незнакомые эквити
}

/* ─── нормализация в доллары ─── */

/* Котировки на этом чейне идут в трёх деноминациях: USDG, WETH и другие
   акции. Чтобы сложить их в одну книгу, нужен курс каждой деноминации к
   доллару — и считать его надо ПОСЛЕ того, как посчитаны долларовые цены
   USDG-пулов, иначе курс выводится из ещё пустого поля. Отсюда два прохода. */

const quoteKey = (sym) => (sym === "ETH" ? "WETH" : sym);

const median = (xs) => {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/** Первый проход: всё, что котируется в USDG, уже в долларах. */
function usdLegs(rows) {
  for (const r of rows) {
    if (quoteKey(r.quote) !== "USDG") continue;
    r.px = r.pxQuote > 0 ? r.pxQuote : r.pxReported;
    r.pxSource = r.pxQuote > 0 ? "onchain" : "reported";
  }
}

/**
 * Курс деноминации к доллару — из чейна.
 *
 * У каждой не-USDG деноминации есть опорный USDG-пул (canon.mjs выбрал самый
 * глубокий и записал в QUOTE_LEGS). Читаем его состояние тем же способом, что
 * и остальные пулы. Так вся книга держится на чейне: индексатор нужен только
 * чтобы узнать, какие пулы вообще существуют.
 *
 * Если опоры нет, курс выводится из отношения «репорт / он-чейн цена» по
 * медиане всех пулов этой деноминации — хуже, но лучше пустоты.
 */
async function quoteRates(rows) {
  const rates = { USDG: 1 };
  const need = [...new Set(rows.map((r) => quoteKey(r.quote)).filter((q) => q && q !== "USDG"))];

  const legs = need.map((q) => ({ q, leg: QUOTE_LEGS[q] })).filter((x) => x.leg);
  if (legs.length) {
    const calls = [];
    for (const { leg } of legs) {
      if (leg.kind === "v4") {
        calls.push(callItem(CHAIN.v4PoolManager, SEL.extsload + v4Slot(leg.pool).slice(2)));
        calls.push(null);
      } else {
        calls.push(callItem(leg.pool, SEL[leg.priceSel || "slot0"]));
        calls.push(callItem(leg.pool, SEL.token0));
      }
    }
    const res = await rpcBatch(calls.filter(Boolean));

    let k = 0;
    for (const { q, leg } of legs) {
      if (leg.kind === "v4") {
        const st = decodeV4Slot0(res[k++]);
        if (!st) continue;
        const assetIsToken0 = isToken0(leg.addr, TOKENS.USDG.addr);
        rates[q] = quotePerAsset(st.sqrtP, leg.decimals, TOKENS.USDG.decimals, assetIsToken0);
      } else {
        const state = res[k++], t0 = res[k++];
        if (!state || !t0) continue;
        const assetIsToken0 = "0x" + t0.slice(26).toLowerCase() === leg.addr;
        rates[q] = quotePerAsset(decodeSqrtPrice(state), leg.decimals, TOKENS.USDG.decimals, assetIsToken0);
      }
      if (!(rates[q] > 0)) delete rates[q];
    }
  }

  // деноминации без опоры — расчётным путём
  for (const q of need) {
    if (rates[q]) continue;
    const own = rows
      .filter((r) => r.sym === q && quoteKey(r.quote) === "USDG" && r.px > 0 && !r.dead)
      .map((r) => r.px);
    if (own.length) { rates[q] = median(own); continue; }
    const implied = rows
      .filter((r) => quoteKey(r.quote) === q && !r.dead && r.pxReported > 0 && r.pxQuote > 0)
      .map((r) => r.pxReported / r.pxQuote)
      .filter((x) => isFinite(x) && x > 0);
    if (implied.length) rates[q] = median(implied);
  }
  return rates;
}

/** Второй проход: остальные деноминации переводим по курсу. */
function toUsd(rows, rates) {
  for (const r of rows) {
    const q = quoteKey(r.quote);
    if (q === "USDG") continue;

    const rate = rates[q];
    if (r.pxQuote > 0 && rate > 0) {
      r.px = r.pxQuote * rate;
      r.pxSource = "onchain";
    } else {
      r.px = r.pxReported;
      r.pxSource = "reported";
    }
  }

  for (const r of rows) {
    if (r.pxReported > 0 && r.px > 0 && Math.abs(r.px - r.pxReported) / r.pxReported > 0.02) {
      r.stale = true;
    }
  }
  return rows;
}

/* ─── публичный интерфейс ─── */

/* Список пулов меняется редко, а цены — каждый блок. Поэтому индексатор
   опрашивается раз в несколько минут, а всё остальное время книга
   пересчитывается по чейну. Заодно это снимает лишнюю нагрузку с чужого API. */
const DISCOVERY_TTL_MS = 5 * 60 * 1000;
const discovered = new Map(); // sym -> { at, rows }

async function poolsOf(sym) {
  const hit = discovered.get(sym);
  if (hit && Date.now() - hit.at < DISCOVERY_TTL_MS) {
    // отдаём копии: verify дописывает в строки состояние текущего опроса
    return hit.rows.map((r) => ({ ...r }));
  }
  const rows = await discover(sym);
  discovered.set(sym, { at: Date.now(), rows });
  return rows.map((r) => ({ ...r }));
}

export async function buildBook(symbols = TICKERS) {
  // Пятнадцать запросов к индексатору по очереди — это лишние секунды на
  // первом заходе, а страница всё это время показывает прочерки. Идут вместе.
  const lists = await Promise.all(
    symbols.map(async (s) => {
      try {
        return await poolsOf(s);
      } catch (e) {
        console.warn("[vox] discover " + s + ":", e.message);
        const stale = discovered.get(s);
        return stale ? stale.rows.map((r) => ({ ...r })) : [];
      }
    })
  );
  const found = lists.flat();

  const live = found.filter((r) => r.alive || r.dead);
  await verify(live);
  await verifyV4(live);
  usdLegs(live);
  toUsd(live, await quoteRates(live));

  const bySym = {};
  for (const r of live) {
    (bySym[r.sym] = bySym[r.sym] || []).push(r);
  }

  for (const sym of Object.keys(bySym)) {
    const rows = bySym[sym];
    const tradable = rows.filter((r) => !r.dead && r.px > 0 && isFinite(r.px));
    const best = tradable.slice().sort((a, b) => a.px - b.px)[0];
    const worst = tradable.slice().sort((a, b) => b.px - a.px)[0];
    for (const r of rows) {
      r.isBest = best && r.pool === best.pool;
      r.awayPct =
        best && r.px > 0 && isFinite(r.px) ? ((r.px - best.px) / best.px) * 100 : null;
    }
    rows.sort((a, b) => (a.dead ? 1 : 0) - (b.dead ? 1 : 0) || b.liq - a.liq);
    bySym[sym] = {
      rows,
      best,
      spreadPct: best && worst && best.px ? ((worst.px - best.px) / best.px) * 100 : 0,
      pools: rows.length,
      vol24: rows.reduce((s, r) => s + (r.dead ? 0 : r.vol24), 0),
    };
  }

  const venues = new Set(live.filter((r) => !r.dead).map((r) => r.venue));
  return {
    assets: bySym,
    stats: {
      pools: live.filter((r) => !r.dead).length,
      venues: venues.size,
      vol24: live.reduce((s, r) => s + (r.dead ? 0 : r.vol24), 0),
      widest: Math.max(0, ...Object.values(bySym).map((a) => a.spreadPct || 0)),
      at: Date.now(),
    },
  };
}


/* ─── снимок последней книги ─── */

/*
 * Первый расчёт занимает несколько секунд: пятнадцать запросов к индексатору
 * и десяток батчей в ноду. Всё это время экран пустой, и выглядит это как
 * неработающий сайт, а не как загрузка.
 *
 * Поэтому последняя книга кладётся в браузер и рисуется мгновенно при
 * следующем заходе, с явной пометкой «пока не обновлено». Живые числа её
 * заменяют, как только придут. Ключ с версией — чтобы старая форма данных
 * не всплыла после правок движка.
 */
const SNAPSHOT_KEY = "vox.book.v2";
const SNAPSHOT_TTL_MS = 12 * 60 * 60 * 1000;

/** BigInt в JSON не сериализуется, а в строках книги он есть (резервы пулов). */
const dropBigInt = (_k, v) => (typeof v === "bigint" ? undefined : v);

export function saveSnapshot(book) {
  try {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ at: Date.now(), book }, dropBigInt)
    );
  } catch {
    /* приватный режим или нет места — живём без снимка */
  }
}

export function loadSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap?.at || Date.now() - snap.at > SNAPSHOT_TTL_MS) return null;
    if (!snap.book?.assets || !snap.book?.stats) return null;
    snap.book.fromSnapshot = true;
    snap.book.snapshotAt = snap.at;
    return snap.book;
  } catch {
    return null;
  }
}

/* ─── цикл обновления ─── */

export function marketPhase(d = new Date()) {
  const et = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return "weekend";
  return mins >= 570 && mins < 960 ? "open" : "after-hours";
}

export function start(onUpdate, symbols) {
  let stopped = false;

  // сначала — то, что уже знаем, чтобы экран не был пустым
  const cached = loadSnapshot();
  if (cached) onUpdate(cached, null);

  const tick = async () => {
    if (stopped) return;
    try {
      const book = await buildBook(symbols);
      saveSnapshot(book);
      onUpdate(book, null);
    } catch (e) {
      console.error("[vox] engine:", e);
      onUpdate(null, e);
    }
    if (stopped) return;
    const wait =
      marketPhase() === "open" ? DEFAULTS.refreshMs : DEFAULTS.refreshMsClosed;
    setTimeout(tick, wait);
  };
  tick();
  return () => {
    stopped = true;
  };
}

// updated: iteration 13

/* fills.js — лента исполнений: читаем событие RouteExecuted прямо из чейна.
   Никакой базы и никакого индексатора: то, что показано, лежит в блоках. */

import { CHAIN, ROUTER, ROUTER_V4, TOKENS } from "./config.js";
import { rpc } from "./rpc.js";
import { TOPICS, decodeRouteExecuted } from "./abi.js";
import { fmtUnits } from "./quote.js";

/* Блок 0.1 c => ~35 800 блоков в час. */
const BLOCKS_PER_HOUR = Math.round(3600 / CHAIN.blockTimeSec);
const LOOKBACK_HOURS = 3;

/* У ноды жёсткий предел на ширину окна в eth_getLogs — около 10 000 блоков,
   а это всего ~17 минут при блоке в 0.1 c. Трёхчасовой запрос отклонялся
   целиком, и лента всегда показывала «нет сделок», хотя события в цепи были.
   Поэтому идём окнами от свежих к старым и останавливаемся, как только
   набрали нужное число. */
const CHUNK = 9000;

const symbolOf = (addr) => {
  const a = (addr || "").toLowerCase();
  for (const [sym, t] of Object.entries(TOKENS)) if (t.addr === a) return sym;
  return a.slice(0, 6) + "…";
};
const decimalsOf = (addr) => {
  const a = (addr || "").toLowerCase();
  for (const t of Object.values(TOKENS)) if (t.addr === a) return t.decimals;
  return 18;
};

export async function fetchFills({ limit = 20, user = null } = {}) {
  /* Оба роутера пишут одно и то же событие, поэтому лента читается одним
     запросом по двум адресам: сделка в v4 попадает в неё наравне с v3. */
  const routers = [ROUTER, ROUTER_V4].filter((r) => r?.address);
  if (!routers.length) return [];

  const headHex = await rpc("eth_blockNumber", []);
  const head = parseInt(headHex, 16);
  const span = BLOCKS_PER_HOUR * LOOKBACK_HOURS;
  let from = Math.max(0, head - span);
  // самый ранний из деплоев: раньше него событий быть не может
  const earliest = Math.min(...routers.map((r) => r.deployBlock || 0).filter(Boolean));
  if (earliest && earliest > from) from = earliest;

  const topics = [TOPICS.RouteExecuted];
  if (user) topics.push("0x" + user.toLowerCase().replace(/^0x/, "").padStart(64, "0"));

  const address = routers.map((r) => r.address);
  const found = [];

  // от свежих блоков к старым: последние сделки почти всегда в первом окне,
  // и до конца периода дело обычно не доходит
  for (let hi = head; hi >= from && found.length < limit; hi -= CHUNK) {
    const lo = Math.max(from, hi - CHUNK + 1);
    let logs;
    try {
      logs = await rpc("eth_getLogs", [
        {
          address,
          fromBlock: "0x" + lo.toString(16),
          toBlock: "0x" + hi.toString(16),
          topics,
        },
      ]);
    } catch {
      // одно окно не отдалось — остальные всё равно смотрим
      continue;
    }
    for (const l of logs || []) found.push(l);
  }

  return found
    .map(decodeRouteExecuted)
    .filter(Boolean)
    .sort((a, b) => b.block - a.block)
    .slice(0, limit)
    .map(enrich);
}

function enrich(f) {
  const dIn = decimalsOf(f.tokenIn);
  const dOut = decimalsOf(f.tokenOut);
  return {
    ...f,
    symIn: symbolOf(f.tokenIn),
    symOut: symbolOf(f.tokenOut),
    amountInText: fmtUnits(f.amountIn, dIn, dIn === 6 ? 2 : 4),
    amountOutText: fmtUnits(f.amountOut, dOut, dOut === 6 ? 2 : 6),
    link: CHAIN.explorer + "/tx/" + f.txHash,
    // сколько блоков назад -> в секунды: у чейна нет дешёвого способа
    // получить timestamp каждого лога, а высота блока честнее «примерно».
  };
}

/** Периодический опрос ленты. Возвращает функцию остановки. */
export function watchFills(onUpdate, { intervalMs = 30000, user = null } = {}) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      onUpdate(await fetchFills({ user }), null);
    } catch (e) {
      onUpdate(null, e);
    }
    if (!stopped) setTimeout(tick, intervalMs);
  };
  tick();
  return () => {
    stopped = true;
  };
}

/** Возраст в блоках -> человеческая строка. */
export function agoText(block, head) {
  const sec = Math.max(0, (head - block) * CHAIN.blockTimeSec);
  if (sec < 60) return Math.round(sec) + "s ago";
  if (sec < 3600) return Math.round(sec / 60) + "m ago";
  return (sec / 3600).toFixed(1) + "h ago";
}

// updated: iteration 19

// updated: iteration 29

// updated: iteration 32

/* rpc.js — доступ к чейну 4663 из браузера.

   По умолчанию ходим через собственный /api/rpc. Прямой RPC формально
   разрешает CORS, но живьём отдаёт заголовок дважды ("*,*") и браузер такой
   ответ отбрасывает; плюс он троттлит всплески. Прямой путь остаётся
   запасным — на случай, если статика поднята без нашей функции.

   Размер батча нода режет жёстко, и не по числу запросов, а по объёму работы:
   замер по разным пулам даёт 20 вызовов с паузой 250 мс — двенадцать батчей
   подряд без единого отказа, а 40 и 60 отваливаются в 429 почти сразу.
   Отсюда эти два числа; менять их — только с новым замером. */

import { CHAIN } from "./config.js";

/* Размер батча подбираем на ходу. За прокси может стоять как публичная нода
   (режется на двадцати вызовах), так и своя (принимает две сотни одним
   запросом). Начинаем с большого, при отказе ужимаемся вдвое и запоминаем —
   так на своей ноде книга читается одним запросом, а на публичной ничего не
   ломается. */
const CHUNK_MAX = 160;
const CHUNK_MIN = 20;
let chunk = CHUNK_MAX;
let gap = 0;
const RETRIES = 5;

let route = CHAIN.proxy ? "proxy" : "direct";
let reqId = 0;

const endpoint = () => (route === "proxy" ? CHAIN.proxy : CHAIN.rpc[0]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(body, url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = new Error("rpc http " + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Отправка с ретраями по троттлингу и одноразовым переключением маршрута. */
async function send(body) {
  let lastErr;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      return await post(body, endpoint());
    } catch (e) {
      lastErr = e;
      // 429/503 — нода придержала: ждём и пробуем тем же маршрутом
      if (e.status === 429 || e.status === 503) {
        await sleep(350 * Math.pow(2, attempt) + Math.random() * 250);
        continue;
      }
      // маршрут не работает вовсе — один раз меняем и пробуем снова
      const other = route === "proxy" ? "direct" : "proxy";
      if (!send._switched) {
        send._switched = true;
        console.warn("[vox] " + route + " unreachable (" + e.message + "), switching to " + other);
        route = other;
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export async function rpc(method, params = []) {
  const j = await send({ jsonrpc: "2.0", id: ++reqId, method, params });
  if (j.error) throw new Error(method + ": " + (j.error.message || "rpc error"));
  return j.result;
}

/** Батч. Возвращает массив в порядке запросов; ошибка отдельного вызова -> null.
    Нарезаем на куски: нода отвечает на 200 вызовов сразу, но не на серию подряд. */
export async function rpcBatch(calls) {
  if (!calls.length) return [];
  const out = [];
  for (let i = 0; i < calls.length; i += chunk) {
    const slice = calls.slice(i, i + chunk);
    const body = slice.map((c) => ({
      jsonrpc: "2.0",
      id: ++reqId,
      method: c.method,
      params: c.params || [],
    }));
    // Кусок мог не пройти — тогда в этих позициях будет null, а книга
    // построится по остальным. Ронять весь опрос из-за одного батча нельзя:
    // на экране это выглядит как «чейн недоступен», хотя он доступен.
    let arr = null;
    try {
      arr = await send(body);
    } catch (e) {
      // не прошёл — вероятно, за прокси публичная нода: ужимаемся и не спешим
      if (chunk > CHUNK_MIN) {
        chunk = Math.max(CHUNK_MIN, Math.floor(chunk / 2));
        gap = 250;
        console.warn("[vox] batch failed, reducing size to " + chunk);
      } else {
        console.warn("[vox] batch failed (" + e.message + "), skipping " + body.length + " calls");
      }
    }
    const byId = new Map(Array.isArray(arr) ? arr.map((r) => [r.id, r]) : []);
    for (const b of body) {
      const r = byId.get(b.id);
      out.push(!r || r.error ? null : r.result);
    }
    if (i + chunk < calls.length && gap) await sleep(gap);
  }
  return out;
}

export const ethCall = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);
export const callItem = (to, data) => ({ method: "eth_call", params: [{ to, data }, "latest"] });

export const hexToBig = (h) => (!h || h === "0x" ? 0n : BigInt(h));
export const hexToInt = (h) => (!h ? 0 : parseInt(h, 16));
export const toHex = (n) => "0x" + BigInt(n).toString(16);

export const blockNumber = async () => hexToInt(await rpc("eth_blockNumber"));

/** eth_getLogs; на этом чейне окно до 100k блоков за вызов. */
export async function getLogs({ address, topics, fromBlock, toBlock }) {
  const tip = toBlock ?? (await blockNumber());
  const from = Math.max(0, fromBlock ?? tip - 100000);
  return rpc("eth_getLogs", [
    { address, topics, fromBlock: toHex(from), toBlock: toHex(tip) },
  ]);
}

/* ─── селекторы, которые нужны движку ─── */
export const SEL = {
  decimals: "0x313ce567",
  symbol: "0x95d89b41",
  balanceOf: "0x70a08231",
  allowance: "0xdd62ed3e",
  token0: "0x0dfe1681",
  token1: "0xd21220a7",
  getReserves: "0x0902f1ac",
  slot0: "0x3850c7bd",
  globalState: "0xe76c01e4", // Algebra отдаёт sqrtPriceX96 тем же первым словом
  liquidity: "0x1a686502",
  fee: "0xddca3f43",
  extsload: "0x1e2eaeaf", // синглтон v4
};

export const padAddr = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
export const padUint = (n) => BigInt(n).toString(16).padStart(64, "0");

/** slot0() -> sqrtPriceX96 (первое слово) */
export const decodeSqrtPrice = (hex) =>
  !hex || hex.length < 66 ? 0n : BigInt("0x" + hex.slice(2, 66));

/** getReserves() -> [reserve0, reserve1] */
export function decodeReserves(hex) {
  if (!hex || hex.length < 130) return [0n, 0n];
  return [BigInt("0x" + hex.slice(2, 66)), BigInt("0x" + hex.slice(66, 130))];
}

export const decodeAddress = (hex) =>
  !hex || hex.length < 66 ? null : "0x" + hex.slice(26, 66).toLowerCase();

// updated: iteration 15

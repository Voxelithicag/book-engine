# Voxelithic Book Engine

The aggregation engine that powers Voxelithic. Reads every venue on Robinhood Chain into one order book with exact on-chain quotes.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   book-engine                    │
├──────────┬──────────┬──────────┬────────────────┤
│  engine  │  router  │  quoter  │     fills      │
│ (prices) │ (paths)  │ (sizes)  │   (history)    │
├──────────┴──────────┴──────────┴────────────────┤
│                    rpc.js                        │
│             (batched JSON-RPC)                   │
└─────────────────────────────────────────────────┘
```

## Modules

| Module | Purpose |
|--------|---------|
| `engine.js` | Reads pool state from all venues, computes best bid/ask |
| `route.js` | Finds optimal execution path across venues and families |
| `quote.js` | Formats quotes with proper decimal handling |
| `fills.js` | Reads RouteExecuted events via windowed eth_getLogs |
| `rpc.js` | Batched JSON-RPC with retry and timeout |
| `abi.js` | ABI encoding/decoding for router and quoter calls |
| `config.js` | Chain config, contract addresses, token registry |
| `keccak.js` | Keccak-256 for v4 pool ID computation |

## Venues

- **Uniswap v4** — singleton pools via `extsload`
- **Uniswap v3** — concentrated liquidity
- **Ramses v3** — concentrated liquidity (Ramses fork)
- **Giga** — concentrated liquidity
- **Up Exchange** — constant product (v2-style)

## Key design decisions

1. **No indexer** — all data from `eth_call` and `eth_getLogs`
2. **Windowed logs** — node limits range to ~10k blocks; walks backwards in 9000-block chunks
3. **Homogeneous routes** — path is all-v3 or all-v4, never mixed
4. **SPY as bridge** — multi-hop paths route through SPY for cross-pair liquidity

## License

BUSL-1.1

// updated: iteration 18

<!-- v1000 -->

/* СГЕНЕРИРОВАНО verify/canon.mjs — не править руками.
   Обновить: node verify/canon.mjs --config   (2026-08-30) */

export const CHAIN = {
  "id": 4663,
  "idHex": "0x1237",
  "rpc": [
    "https://rpc.mainnet.chain.robinhood.com"
  ],
  "proxy": "/api/rpc",
  "explorer": "https://robinhoodchain.blockscout.com",
  "blockTimeSec": 0.1007,
  "v4PoolManager": "0x8366a39cc670b4001a1121b8f6a443a643e40951",
  "v4PoolsSlot": 6
};

export const ROUTER = { address: "0x87cD7EbE8c213455e5e5a8554657D5f294a82e64", deployBlock: 50072426 };
export const QUOTER = { address: "0x9616627E871c96e38cb21b9551F62Ed93366bE1B" };

/* Исполнение в v4. Отдельные контракты, потому что у v4 нет контрактов пулов:
   своп идёт через замок синглтона с колбэком и ручным расчётом долгов. */
export const ROUTER_V4 = { address: "0x290b9b46308f7a3B80A5F62214B426d3bfAfaab5", deployBlock: 50282817 };
export const QUOTER_V4 = { address: "0x5858F06894623eF4862103A747074E5AA3436d4F" };

export const TOKENS = {
  "NVDA": {
    "addr": "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec",
    "decimals": 18,
    "name": "NVIDIA • Robinhood Token"
  },
  "SPY": {
    "addr": "0x117cc2133c37b721f49de2a7a74833232b3b4c0c",
    "decimals": 18,
    "name": "SPDR S&P 500 ETF Trust • Robinhood Token"
  },
  "AAPL": {
    "addr": "0xaf3d76f1834a1d425780943c99ea8a608f8a93f9",
    "decimals": 18,
    "name": "Apple • Robinhood Token"
  },
  "TSM": {
    "addr": "0x58ffe4a942d3885baa22d7520691f611ef09e7aa",
    "decimals": 18,
    "name": "Taiwan Semiconductor Manufacturing • Robinhood Token"
  },
  "MSTR": {
    "addr": "0xec262a75e413fafd0df80480274532c79d42da09",
    "decimals": 18,
    "name": "Strategy Inc. • Robinhood Token"
  },
  "GOOGL": {
    "addr": "0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3",
    "decimals": 18,
    "name": "Alphabet Class A • Robinhood Token"
  },
  "COIN": {
    "addr": "0x6330d8c3178a418788df01a47479c0ce7ccf450b",
    "decimals": 18,
    "name": "Coinbase • Robinhood Token"
  },
  "MU": {
    "addr": "0xff080c8ce2e5feadaca0da81314ae59d232d4afd",
    "decimals": 18,
    "name": "Micron Technology • Robinhood Token"
  },
  "TSLA": {
    "addr": "0x322f0929c4625ed5bad873c95208d54e1c003b2d",
    "decimals": 18,
    "name": "Tesla • Robinhood Token"
  },
  "META": {
    "addr": "0xc0d6457c16cc70d6790dd43521c899c87ce02f35",
    "decimals": 18,
    "name": "Meta Platforms • Robinhood Token"
  },
  "PLTR": {
    "addr": "0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a",
    "decimals": 18,
    "name": "Palantir Technologies • Robinhood Token"
  },
  "QQQ": {
    "addr": "0xd5f3879160bc7c32ebb4dc785f8a4f505888de68",
    "decimals": 18,
    "name": "Invesco QQQ • Robinhood Token"
  },
  "AMD": {
    "addr": "0x86923f96303d656e4aa86d9d42d1e57ad2023fdc",
    "decimals": 18,
    "name": "AMD • Robinhood Token"
  },
  "NFLX": {
    "addr": "0xe0444ef8bf4ed74f74fd73686e2ddf4c1c5591e8",
    "decimals": 18,
    "name": "Netflix • Robinhood Token"
  },
  "AMZN": {
    "addr": "0x12f190a9f9d7d37a250758b26824b97ce941bf54",
    "decimals": 18,
    "name": "Amazon • Robinhood Token"
  },
  "USDG": {
    "addr": "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
    "decimals": 6,
    "name": "USDG"
  },
  "WETH": {
    "addr": "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
    "decimals": 18,
    "name": "Wrapped Ether"
  }
};

export const VENUES = {
  "Uniswap v3": {
    "kind": "v3",
    "dexId": "uniswap",
    "priceSel": "slot0",
    "executable": true,
    "feePpm": null
  },
  "Uniswap v4": {
    "kind": "v4",
    "dexId": "uniswap",
    "priceSel": null,
    "executable": true,
    "feePpm": null
  },
  "Ramses": {
    "kind": "v3",
    "dexId": "ramses",
    "priceSel": "slot0",
    "executable": true,
    "feePpm": null
  },
  "Giga": {
    "kind": "v3",
    "dexId": "giga",
    "priceSel": "slot0",
    "executable": true,
    "feePpm": null
  },
  "Up": {
    "kind": "v3",
    "dexId": "up",
    "priceSel": "slot0",
    "executable": true,
    "feePpm": null
  },
  "Alandale": {
    "kind": "v3a",
    "dexId": "alandale",
    "priceSel": "globalState",
    "executable": true,
    "feePpm": null
  }
};

/* Неизменяемые свойства пулов: token0/token1/ставка. Считаны при сборке,
   чтобы первый заход не тратил на них ~180 вызовов. Цены здесь не кэшируются. */
export const POOL_FACTS = {"0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec","feePpm":500},"0x62AB521f71431f78ac374CdbadC6cda3c8916b6C":{"token0":"0x0bd7d308f8e1639fab988df18a8011f41eacad73","token1":"0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec","feePpm":500},"0xC0Be1cb0f674D9737C72B2A63fC542361185b807":{"token0":"0x0bd7d308f8e1639fab988df18a8011f41eacad73","token1":"0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec","feePpm":3000},"0xDDCBBa3666f578E3F09516f21Ff85BFee859AB5e":{"token0":"0x0bd7d308f8e1639fab988df18a8011f41eacad73","token1":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","feePpm":500},"0x38453c115607463Ac284820Ce959831042f3Df4E":{"token0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","token1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","feePpm":100},"0xd89cAc2dD5cE9F8D655d9F6E20EEed18Efc9DAEF":{"token0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","token1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","feePpm":100},"0xa7Bb1AC63BBaB0C44316E6c8C455213441689167":{"token0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","token1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","feePpm":500},"0x3e1afDe90341F843c941fF4077d915bDE3008c7E":{"token0":"0x0bd7d308f8e1639fab988df18a8011f41eacad73","token1":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","feePpm":100},"0x47A2a145308d55eaa957920876Ab626730eAF90b":{"token0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","token1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","feePpm":500},"0xAae0d815EE56e4092a5E5C2911E676Fea50B2d6D":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0xaf3d76f1834a1d425780943c99ea8a608f8a93f9","feePpm":500},"0x19D55ABa3E5d2C389B7011c634725136dFDcaE33":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0xaf3d76f1834a1d425780943c99ea8a608f8a93f9","feePpm":1000},"0x8bb3514e2204E1cDF3Ac149EFEe7Ff04D91B719f":{"token0":"0x0bd7d308f8e1639fab988df18a8011f41eacad73","token1":"0xaf3d76f1834a1d425780943c99ea8a608f8a93f9","feePpm":500},"0x783C9bbB765047CFdD2b84b92b2Ca9F11D34b7Ed":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0xaf3d76f1834a1d425780943c99ea8a608f8a93f9","feePpm":3000},"0x70504a6FafdbfB75fE971FAA4dD716e79aC5624c":{"token0":"0x0bd7d308f8e1639fab988df18a8011f41eacad73","token1":"0xec262a75e413fafd0df80480274532c79d42da09","feePpm":10000},"0x17578C0e0D15da44f31677263114F71aE76653EA":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0xec262a75e413fafd0df80480274532c79d42da09","feePpm":10000},"0x34D0dC122CF9A8Eb296fC5e0D3A233625D7d19b7":{"token0":"0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3","token1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","feePpm":500},"0x6707aeAc7D0e519B083219d27BB427364363183A":{"token0":"0x0bd7d308f8e1639fab988df18a8011f41eacad73","token1":"0x6330d8c3178a418788df01a47479c0ce7ccf450b","feePpm":3000},"0xd057B1Bc54917855BBee58eAd58647f47caB35E5":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0xff080c8ce2e5feadaca0da81314ae59d232d4afd","feePpm":3000},"0x6fD0f36320A1E50e42f130CE4A5C530B992a0A14":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0xff080c8ce2e5feadaca0da81314ae59d232d4afd","feePpm":500},"0x352771B68da27e3BeCe96eB2c8532D7faeD1de1B":{"token0":"0x0bd7d308f8e1639fab988df18a8011f41eacad73","token1":"0x322f0929c4625ed5bad873c95208d54e1c003b2d","feePpm":553},"0xf4ACdAEEB7022862A763C9B1B885e11191c889E3":{"token0":"0x322f0929c4625ed5bad873c95208d54e1c003b2d","token1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","feePpm":3000},"0x851680416A4f4E1c463d45171d61ACDdBc8554c0":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a","feePpm":3000},"0xD60A5d14dB690B7Afad71F76B108071D7175597d":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0xd5f3879160bc7c32ebb4dc785f8a4f505888de68","feePpm":500},"0xEbD78dcfc8a6b3A696f1E191aD1ff321f9579f79":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0xd5f3879160bc7c32ebb4dc785f8a4f505888de68","feePpm":3000},"0x48D284A2A4d3DC1b3Da08231Fe44317e7e7Aa51f":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0x86923f96303d656e4aa86d9d42d1e57ad2023fdc","feePpm":3000},"0x59895C0302F41aEaa129D2fa2442CEc01E7eF45E":{"token0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","token1":"0xe0444ef8bf4ed74f74fd73686e2ddf4c1c5591e8","feePpm":3000},"0x8AC92DA74AB5F3b1d024Dc1943Ad7e15Dc4179Ef":{"token0":"0x12f190a9f9d7d37a250758b26824b97ce941bf54","token1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","feePpm":3000}};

/* Опорные пулы: цена каждой деноминации читается из чейна, а не у индексатора. */
export const QUOTE_LEGS = {
  "WETH": {
    "pool": "0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca",
    "addr": "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
    "decimals": 18,
    "kind": "v3",
    "priceSel": "slot0",
    "liq": 7939950
  },
  "TSLA": {
    "pool": "0x8517f8071ae5b831b738052f12125e8e3d6c158b78728aa44ce3b25e5104d32e",
    "addr": "0x322f0929c4625ed5bad873c95208d54e1c003b2d",
    "decimals": 18,
    "kind": "v4",
    "priceSel": null,
    "liq": 250852
  },
  "MU": {
    "pool": "0x6fa3ee0048e78bf0a513eb0ab56f482944a767c21db990fcf555605e69f05659",
    "addr": "0xff080c8ce2e5feadaca0da81314ae59d232d4afd",
    "decimals": 18,
    "kind": "v4",
    "priceSel": null,
    "liq": 381242
  },
  "MSFT": {
    "pool": "0x9194a557b6a6bb2236b49ea7e2bbccec5d3eeb705aef00903be4b3de1d949579",
    "addr": "0xe93237c50d904957cf27e7b1133b510c669c2e74",
    "decimals": 18,
    "kind": "v4",
    "priceSel": null,
    "liq": 142793
  },
  "TSM": {
    "pool": "0x0ba5d53d2f6255f334b7c8ead4f56b6aef5af3402c5e4d11180afd38c6b85fb1",
    "addr": "0x58ffe4a942d3885baa22d7520691f611ef09e7aa",
    "decimals": 18,
    "kind": "v4",
    "priceSel": null,
    "liq": 90147
  },
  "NVDA": {
    "pool": "0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3",
    "addr": "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec",
    "decimals": 18,
    "kind": "v3",
    "priceSel": "slot0",
    "liq": 5937532
  },
  "SPY": {
    "pool": "0xfe2a80bb5618fd14984b92ca6d45bf5ba67443ddb1435e28b2e48df2fc1526cd",
    "addr": "0x117cc2133c37b721f49de2a7a74833232b3b4c0c",
    "decimals": 18,
    "kind": "v4",
    "priceSel": null,
    "liq": 3502819
  }
};


/* PoolKey пулов Uniswap v4, восстановленные из событий Initialize и
   проверенные обратным хешем. Пулы с хуками помечены routable:false —
   хук это чужой код в середине свопа. Обновить: node verify/poolkeys.mjs --config */


/* PoolKey пулов Uniswap v4, восстановленные из событий Initialize и
   проверенные обратным хешем. Пулы с хуками помечены routable:false —
   хук это чужой код в середине свопа. Обновить: node verify/poolkeys.mjs --config */
export const POOL_KEYS = {"0x647836c4965c512f0d82a2128abe7826eacf5a79d2dbed252a89ba5c591d1e87":{"currency0":"0x0bd7d308f8e1639fab988df18a8011f41eacad73","currency1":"0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec","fee":1000,"tickSpacing":2,"hooks":"0x0000000000000000000000000000000000000000","sym":"NVDA","quote":"WETH","liq":43306,"routable":true},"0x71f9660f9535e3e81d720696a58ea80274da8b2c6eb7c3acb22611d977439a5c":{"currency0":"0x0000000000000000000000000000000000000000","currency1":"0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec","fee":500,"tickSpacing":10,"hooks":"0x0000000000000000000000000000000000000000","sym":"NVDA","quote":"ETH","liq":23294,"routable":true},"0x69d1983f3f5a36d2c7d445247c399faabc0f3a33bec8b40cd19283aae8e83a1f":{"currency0":"0x0bd7d308f8e1639fab988df18a8011f41eacad73","currency1":"0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec","fee":8388608,"tickSpacing":1,"hooks":"0x662e38a4fe64164f375776cded2fcacf23678880","sym":"NVDA","quote":"WETH","liq":30525,"routable":false},"0xfe2a80bb5618fd14984b92ca6d45bf5ba67443ddb1435e28b2e48df2fc1526cd":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","fee":3000,"tickSpacing":60,"hooks":"0x0000000000000000000000000000000000000000","sym":"SPY","quote":"USDG","liq":3211113,"routable":true},"0xe5923c8a8be481ec89a2ca784a2bbfa4235de6d88f92260fd66b660c4babf907":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"SPY","quote":"USDG","liq":467536,"routable":true},"0xa821b3724b451b22476c5347471b2a96d185b86af8760f226273e34ab4b2b8a0":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x322f0929c4625ed5bad873c95208d54e1c003b2d","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"SPY","quote":"TSLA","liq":260648,"routable":true},"0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","fee":8388608,"tickSpacing":10,"hooks":"0xa0e8fbff13e24af2b5e61a72800e08a161bde080","sym":"SPY","quote":"USDG","liq":697187,"routable":false},"0xcc2a903a8744a65258bb07fbeea553a25410f731c9fef306321d0c176a09542c":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0xff080c8ce2e5feadaca0da81314ae59d232d4afd","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"SPY","quote":"MU","liq":254716,"routable":true},"0xaef5609ceaf79abbd244bcd5198723bf34c50b33136ff3dca52dd559d9554741":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0xe93237c50d904957cf27e7b1133b510c669c2e74","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"SPY","quote":"MSFT","liq":264755,"routable":true},"0x20fa8410ec5bc2db079661feebfef0bbd6dfafcbaf3e52ee0e788a0b346dc5b8":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","fee":555,"tickSpacing":6,"hooks":"0x0000000000000000000000000000000000000000","sym":"SPY","quote":"USDG","liq":174208,"routable":true},"0x4c862e5846659b086fe73896bbb9058513417e4e6938a1be93aeb7a768fa5754":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x58ffe4a942d3885baa22d7520691f611ef09e7aa","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"SPY","quote":"TSM","liq":346162,"routable":true},"0xbc732a1a0baabce2574ec2bca24fccad8e2c38a061a37cefc17a2fd12809394f":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"SPY","quote":"NVDA","liq":247782,"routable":true},"0x7d32bc830f40a330af8723b8bb50d4d6b0152297d659e9898e6a47b785686459":{"currency0":"0x0000000000000000000000000000000000000000","currency1":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","fee":10000,"tickSpacing":200,"hooks":"0x0000000000000000000000000000000000000000","sym":"SPY","quote":"ETH","liq":43435,"routable":true},"0x2b397a8cfa01a41c0a2e5d326abd113a5d3fbb5b1ad2ae77294a6827065b316c":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","fee":8388608,"tickSpacing":60,"hooks":"0x8e5da0d5a0b50f1c1dd7a26763426646bbdd8880","sym":"SPY","quote":"USDG","liq":38972,"routable":false},"0xc748f4671a867db48b552f6b7650bf3255e05f80f00e3f7aad1b17ccb7898fdb":{"currency0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","currency1":"0xaf3d76f1834a1d425780943c99ea8a608f8a93f9","fee":3000,"tickSpacing":60,"hooks":"0x0000000000000000000000000000000000000000","sym":"AAPL","quote":"USDG","liq":375924,"routable":true},"0x0ba5d53d2f6255f334b7c8ead4f56b6aef5af3402c5e4d11180afd38c6b85fb1":{"currency0":"0x58ffe4a942d3885baa22d7520691f611ef09e7aa","currency1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","fee":7500,"tickSpacing":75,"hooks":"0x0000000000000000000000000000000000000000","sym":"TSM","quote":"USDG","liq":88752,"routable":true},"0x319bac87e616a89e241c10aeb8afd4892a852cdd8b373cd9765ecddc40b87cfe":{"currency0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","currency1":"0xec262a75e413fafd0df80480274532c79d42da09","fee":2500,"tickSpacing":25,"hooks":"0x0000000000000000000000000000000000000000","sym":"MSTR","quote":"USDG","liq":37095,"routable":true},"0x2bca43d9d8c75399e3c6ba14e9dc88f44ca8968bb4694a8be4f80bd5a550df2e":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"GOOGL","quote":"SPY","liq":295545,"routable":true},"0xd4ecb79fdc521d7725d22b33ed43cb4e47aa96bfad76aa29577e3151f723ac5e":{"currency0":"0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3","currency1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","fee":3000,"tickSpacing":60,"hooks":"0x0000000000000000000000000000000000000000","sym":"GOOGL","quote":"USDG","liq":202450,"routable":true},"0x982af6ff6a2169c91a78634d3d10b3e1fe1e6a7e76387de04167234a41d50e4c":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x6330d8c3178a418788df01a47479c0ce7ccf450b","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"COIN","quote":"SPY","liq":185929,"routable":true},"0x6fa3ee0048e78bf0a513eb0ab56f482944a767c21db990fcf555605e69f05659":{"currency0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","currency1":"0xff080c8ce2e5feadaca0da81314ae59d232d4afd","fee":10000,"tickSpacing":200,"hooks":"0x0000000000000000000000000000000000000000","sym":"MU","quote":"USDG","liq":381953,"routable":true},"0x5fb97aef826b674c4bc76707563816f171043a3b1bf91431b7f82acd6381876b":{"currency0":"0x0000000000000000000000000000000000000000","currency1":"0xff080c8ce2e5feadaca0da81314ae59d232d4afd","fee":10000,"tickSpacing":200,"hooks":"0x0000000000000000000000000000000000000000","sym":"MU","quote":"ETH","liq":50074,"routable":true},"0x8517f8071ae5b831b738052f12125e8e3d6c158b78728aa44ce3b25e5104d32e":{"currency0":"0x322f0929c4625ed5bad873c95208d54e1c003b2d","currency1":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","fee":3000,"tickSpacing":60,"hooks":"0x0000000000000000000000000000000000000000","sym":"TSLA","quote":"USDG","liq":253131,"routable":true},"0xe6b713cf680868a40aafca45810b0c894eb5c696f5a2230d4816e6695e90e681":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0xc0d6457c16cc70d6790dd43521c899c87ce02f35","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"META","quote":"SPY","liq":262905,"routable":true},"0x5875d407a42965b0e768c8925cea290e06fa50603ef34fc99eb92a1050e6ae36":{"currency0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","currency1":"0xc0d6457c16cc70d6790dd43521c899c87ce02f35","fee":3000,"tickSpacing":60,"hooks":"0x0000000000000000000000000000000000000000","sym":"META","quote":"USDG","liq":38216,"routable":true},"0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5":{"currency0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","currency1":"0xc0d6457c16cc70d6790dd43521c899c87ce02f35","fee":8388608,"tickSpacing":10,"hooks":"0x8af95932ec4484fb10c641a4cbcf19a798cb2080","sym":"META","quote":"USDG","liq":24970,"routable":false},"0xb8d9b6b622bb03dd06d95790553f327710a73d85d845a59fa9e652638ca96ae6":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"PLTR","quote":"SPY","liq":197906,"routable":true},"0xee430ee1003e1985e1828a01b9a20dad67ad4302994fe2abb4a173de4ac54623":{"currency0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","currency1":"0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a","fee":10000,"tickSpacing":200,"hooks":"0x0000000000000000000000000000000000000000","sym":"PLTR","quote":"USDG","liq":205631,"routable":true},"0xf38009b348295f907c1f2e22aba84d731de3b7360d312881df1c206e85ea3b0b":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0xd5f3879160bc7c32ebb4dc785f8a4f505888de68","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"QQQ","quote":"SPY","liq":529101,"routable":true},"0xe6e17efdbdd916526293cf1b509171be4ffb04f47c4a5fe1a7367acdaa6ffd82":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x86923f96303d656e4aa86d9d42d1e57ad2023fdc","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"AMD","quote":"SPY","liq":337303,"routable":true},"0xde9f85fdd9e05a943a52f2c69ffafe3064a3287df03d02c9b431bc92d4781274":{"currency0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","currency1":"0x86923f96303d656e4aa86d9d42d1e57ad2023fdc","fee":10000,"tickSpacing":200,"hooks":"0x0000000000000000000000000000000000000000","sym":"AMD","quote":"USDG","liq":70915,"routable":true},"0xe4930a6215f21aa3b37c01adbded3362f56ae31b9a60066f5f9641e601d5111f":{"currency0":"0x5fc5360d0400a0fd4f2af552add042d716f1d168","currency1":"0xe0444ef8bf4ed74f74fd73686e2ddf4c1c5591e8","fee":10000,"tickSpacing":100,"hooks":"0x0000000000000000000000000000000000000000","sym":"NFLX","quote":"USDG","liq":135755,"routable":true},"0x68beff3b4270ffbbb78a48d7670648909b9de6736456b0f450fee242e1d10a8b":{"currency0":"0x117cc2133c37b721f49de2a7a74833232b3b4c0c","currency1":"0x12f190a9f9d7d37a250758b26824b97ce941bf54","fee":500,"tickSpacing":5,"hooks":"0x0000000000000000000000000000000000000000","sym":"AMZN","quote":"SPY","liq":388893,"routable":true}};

export const TICKERS = ["NVDA","SPY","AAPL","TSM","MSTR","GOOGL","COIN","MU","TSLA","META","PLTR","QQQ","AMD","NFLX","AMZN"];

export const LIVENESS = {"minLiq":20000,"minVol":50000,"minTx":20};

export const DEFAULTS = { slippageBps: 100, refreshMs: 20000, refreshMsClosed: 120000, deadlineSec: 300 };

# ABC Extractors — Composable Intelligence Filters

*Write a JSON file. Extract alpha from any website.*

## What It Does

Composable extractor definitions for the ABC Intelligence browser extension. Each extractor is a JSON file that tells the engine what to look for on a specific website.

**Anyone can write an extractor. Everyone benefits from the extraction.**

## How Extractors Work

An extractor is just JSON:

```json
{
  "id": "twitter-v1",
  "name": "Twitter/X Feed Extractor",
  "matches": ["https://*.x.com/*"],
  "platform": "twitter",
  "selectors": {
    "post": "article[data-testid='tweet']",
    "content": "div[data-testid='tweetText']",
    "author_handle": "div[data-testid='User-Name'] a span"
  },
  "extract": {
    "tokens": {
      "tickers": "\\$([A-Z][A-Z0-9]{1,11})\\b",
      "eth_addresses": "(0x[a-fA-F0-9]{40})"
    }
  },
  "observation": {
    "mode": "intersection",
    "min_visible_ms": 1000
  }
}
```

The engine loads the definition, watches the page, extracts matching data, and pushes it upstream. Zero code required.

## Built-in Extractors

| Extractor | Platform | What It Catches |
|-----------|----------|----------------|
| twitter-v1 | Twitter/X | Tweets with $tickers, contract addresses, DEX links |
| warpcast-v1 | Warpcast | Farcaster casts with token references |
| github-v1 | GitHub | Repos with contract addresses, package names |

## Write Your Own

1. Create a JSON file following the schema above
2. Define `selectors` for the target site's DOM
3. Define `extract.tokens` regex patterns
4. Set `observation.mode` (intersection for feeds, pageload for static pages)
5. Publish to the extractor registry

### Ideas for Community Extractors

- **Reddit** — r/cryptocurrency, r/defi, r/solana token mentions
- **Telegram Web** — group chat token references
- **DEX frontends** — Raydium, Jupiter, Uniswap new pair alerts
- **Product Hunt** — new launches with crypto/AI tags
- **Discord Web** — server token discussions
- **Substack** — newsletter token analysis
- **Mirror.xyz** — on-chain publishing token references

## The Composability Thesis

Each extractor is a LENS on reality. Different lenses see different signals.

A Twitter extractor sees what CT is talking about.
A GitHub extractor sees what builders are shipping.
A DEX extractor sees what traders are buying.

Stack the lenses → composite intelligence → entropy reduction at scale.

The extractors are the product. The intelligence they generate is the network effect. Open source means the network effect compounds for everyone.

## Auto-Update

The ABC extension fetches new extractors from the registry every 6 hours:
```
GET https://intel.metaspn.network/api/extractors
```

Publish an extractor → every ABC user gets it automatically.

## Credits

ABC Intelligence — Always Broadcasting Corporation
A MetaSPN operation.

*"Your browsing history is alpha. You're just not measuring it yet."*

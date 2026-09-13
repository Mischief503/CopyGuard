# Shadow Copy Polling & Helius/AI Integration Fix — v3.3.0

## What changed

- Active Ghost/Shadow wallets are re-read through Helius RPC every **20 seconds**.
- Polling continues until the wallet reaches its configured completed-trade sample (30 by default).
- Each pass requests recent signatures, deduplicates them, fetches full transactions, parses BUY/SELL activity, and routes it through the normal CopyGuard risk + Shadow pipeline.
- Enhanced Helius WebSockets use the Atlas endpoint as a low-latency accelerator; polling remains the authoritative fallback.
- Full exits are detected by comparing the union of pre/post token balances.
- WebSocket and polling deliveries are deduplicated by transaction signature.
- The selected AI provider analyzes Shadow signals when enabled.
- Updated provider defaults: Claude Sonnet 5, GPT-5.6 Luna, Gemini 3.8 Flash, Grok 4.6, Sonar Pro.
- Shadow AI is advisory by default. An optional setting lets AI `SKIP` prevent only the **fake** BUY.
- Shadow processing remains isolated from Padre/live execution.

## Qualification behavior

The 20-second loop stops making Helius history requests for a Shadow wallet once the configured number of **completed simulated trades** is reached. This avoids stopping prematurely after 30 raw chain events when some positions are still open.

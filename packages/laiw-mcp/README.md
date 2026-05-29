# @laiw/mcp

Laiw Legal OS — MCP server wrapping AusLaw legal research tools.

Exposes Australian and New Zealand legal research capabilities as MCP tools, connectable to Claude Desktop, Cursor, Windsurf, and any MCP-compatible client.

## Tools

### Legal Research
- **search_cases** — Search Australian/NZ case law via AustLII and jade.io
- **search_legislation** — Search legislation across all jurisdictions
- **search_by_citation** — Find a case by its citation
- **search_citing_cases** — Citator: find cases that cite a given case (jade.io)
- **fetch_document_text** — Fetch full judgment text with OCR fallback

### Citation Management
- **format_citation** — Format per AGLC4 rules
- **validate_citation** — Validate against AustLII
- **generate_pinpoint** — Generate pinpoint citation to a paragraph
- **normalise_citation** — Normalise citation string
- **cache_citation** — Cache citation in local project
- **get_citation** — Retrieve cached citation by key
- **list_citations** — List cached citations
- **export_bibliography** — Export as BibLaTeX, CSL, or text

### Utilities
- **build_austlii_url** — Build AustLII URL from neutral citation
- **resolve_jade_article** — Resolve jade.io article by ID
- **jade_citation_lookup** — Generate jade.io search URL

## Usage

### Claude Desktop

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "laiw-legal-research": {
      "command": "npx",
      "args": ["-y", "@laiw/mcp"],
      "env": {
        "JADE_SESSION_COOKIE": "your-cookie-here"
      }
    }
  }
}
```

### Cursor / Windsurf

Use the MCP settings in the IDE to add a stdio server:
- Command: `npx`
- Args: `-y @laiw/mcp`

### Direct

```bash
pnpm install --filter @laiw/mcp
pnpm --filter @laiw/mcp build
pnpm --filter @laiw/mcp start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JADE_SESSION_COOKIE` | For jade.io features | Full cookie header from authenticated jade.io browser session |
| `AUSTLII_SEARCH_BASE` | No | Override AustLII search endpoint |
| `AUSTLII_USER_AGENT` | No | Custom User-Agent for AustLII |
| `AUSTLII_TIMEOUT` | No | Request timeout in ms |
| `LAIW_MCP_PORT` | No | Set to a port number (e.g. 3001) for HTTP mode |

## Architecture

This package imports AusLaw's research services directly:
- `services/austlii.ts` — AustLII search and authority scoring
- `services/jade.ts` — jade.io article resolution and GWT-RPC
- `services/citation.ts` — AGLC4 citation parsing/formatting
- `services/fetcher.ts` — Document retrieval with OCR
- `services/citation-cache.ts` — Local citation database
- `utils/rate-limiter.ts` — Rate limiting (10 req/min AustLII, 5 req/min jade)
- `utils/url-guard.ts` — SSRF protection

## License

MIT (same as AusLaw MCP)

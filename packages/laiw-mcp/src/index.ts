#!/usr/bin/env node
/**
 * Laiw MCP Server
 *
 * Wraps AusLaw legal research services and exposes them as MCP tools.
 * Can be run as a stdio-based MCP server or connected to external clients
 * like Claude Desktop, Cursor, Windsurf, etc.
 *
 * Usage:
 *   npx -p @laiw/mcp laiw-mcp                    # stdio mode
 *   LAIW_MCP_PORT=3001 npx -p @laiw/mcp laiw-mcp  # HTTP mode
 */
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { z } from "zod";

// ── AusLaw services ──────────────────────────────────────────────────────────
import path from "node:path";
import { formatFetchResponse, formatSearchResults } from "./utils/formatter.js";
import { fetchDocumentText } from "./services/fetcher.js";
import { searchAustLii, type SearchResult } from "./services/austlii.js";
import { mergeCaseSearchResults } from "./services/search-merge.js";
import {
  resolveArticle,
  buildCitationLookupUrl,
  searchJade,
  searchCitingCases,
} from "./services/jade.js";
import {
  formatAGLC4,
  formatShortForm,
  validateCitation,
  parseCitation,
  generatePinpoint,
  normaliseCitation,
} from "./services/citation.js";
import {
  NEUTRAL_CITATION_PATTERN,
  COURT_TO_AUSTLII_PATH,
  AUSLAW_CACHE_DIR_NAME,
} from "./constants.js";
import {
  upsertCitation,
  getCitation,
  listCitations,
  exportBib,
  updateSourceFields,
  updateCitedBy,
  updateCitedBySource,
  type CitedByRef,
} from "./services/citation-cache.js";
import { storeSource, checkSourceFreshness } from "./services/source-store.js";
import { config } from "./config.js";

// ── Schema helpers ───────────────────────────────────────────────────────────

const formatEnum = z.enum(["json", "text", "markdown", "html"]).default("json");
const jurisdictionEnum = z.enum([
  "cth", "vic", "nsw", "qld", "sa", "wa", "tas", "nt", "act", "federal", "nz", "other",
]);
const sortByEnum = z.enum(["relevance", "date", "auto"]).default("auto");
const caseMethodEnum = z
  .enum(["auto", "title", "phrase", "all", "any", "near", "boolean"])
  .default("auto");
const legislationMethodEnum = z
  .enum(["auto", "title", "phrase", "all", "any", "near", "legis", "boolean"])
  .default("auto");

// Derive AustLII URL from a neutral citation without a network call
function austliiUrlFromNeutral(neutralCitation: string): string | undefined {
  const m = normaliseCitation(neutralCitation).match(NEUTRAL_CITATION_PATTERN);
  if (!m) return undefined;
  const [, year, court, num] = m;
  const austliiPath = COURT_TO_AUSTLII_PATH[court!];
  if (!austliiPath) return undefined;
  return `https://www.austlii.edu.au/cgi-bin/viewdoc/${austliiPath}/${year}/${num}.html`;
}

// ── Server factory ───────────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "laiw-legal-research",
    version: "0.1.0",
    description:
      "Laiw Legal OS — Australian and New Zealand legal research via AustLII, jade.io, with AGLC4 citation support and OCR-aware document retrieval.",
  });

  // ── search_cases ─────────────────────────────────────────────────────
  const searchCasesShape = {
    query: z.string().min(1, "Query cannot be empty."),
    jurisdiction: jurisdictionEnum.optional(),
    limit: z.number().int().min(1).max(50).optional(),
    format: formatEnum.optional(),
    sortBy: sortByEnum.optional(),
    method: caseMethodEnum.optional(),
    offset: z.number().int().min(0).max(500).optional(),
  };
  const searchCasesParser = z.object(searchCasesShape);

  server.registerTool(
    "search_cases",
    {
      title: "Search Australian Case Law",
      description:
        "Search Australian and New Zealand case law via AustLII and jade.io. Jurisdictions: cth, vic, nsw, qld, sa, wa, tas, nt, act, federal, nz, other. Methods: auto, title, phrase, all, any, near, boolean. Sorting: auto (smart), relevance, date. Primary sources only — no journals. Offset for pagination.",
      inputSchema: searchCasesShape,
    },
    async (rawInput) => {
      const { query, jurisdiction, limit, format, sortBy, method, offset } =
        searchCasesParser.parse(rawInput);
      const [austliiResults, jadeResults] = await Promise.all([
        searchAustLii(query, { type: "case", jurisdiction, limit, sortBy, method, offset }),
        searchJade(query, { type: "case", jurisdiction, limit }),
      ]);
      const merged = mergeCaseSearchResults(austliiResults, jadeResults, limit);
      return formatSearchResults(merged, format ?? "json");
    },
  );

  // ── search_legislation ────────────────────────────────────────────────
  const searchLegislationShape = {
    query: z.string().min(1, "Query cannot be empty."),
    jurisdiction: jurisdictionEnum.optional(),
    limit: z.number().int().min(1).max(50).optional(),
    format: formatEnum.optional(),
    sortBy: sortByEnum.optional(),
    method: legislationMethodEnum.optional(),
    offset: z.number().int().min(0).max(500).optional(),
  };
  const searchLegislationParser = z.object(searchLegislationShape);

  server.registerTool(
    "search_legislation",
    {
      title: "Search Legislation",
      description:
        "Search Australian and New Zealand legislation. Jurisdictions: cth, vic, nsw, qld, sa, wa, tas, nt, act, federal, nz, other. Methods: auto, title, phrase, all, any, near, legis, boolean. Offset for pagination.",
      inputSchema: searchLegislationShape,
    },
    async (rawInput) => {
      const { query, jurisdiction, limit, format, sortBy, method, offset } =
        searchLegislationParser.parse(rawInput);
      const results = await searchAustLii(query, {
        type: "legislation",
        jurisdiction,
        limit,
        sortBy,
        method,
        offset,
      });
      return formatSearchResults(results, format ?? "json");
    },
  );

  // ── fetch_document_text ───────────────────────────────────────────────
  const fetchDocumentShape = {
    url: z.string().url("URL must be valid."),
    format: formatEnum.optional(),
    citeKey: z
      .string()
      .optional()
      .describe("Cite key for caching (updates source fields on fetch)."),
  };
  const fetchDocumentParser = z.object(fetchDocumentShape);

  server.registerTool(
    "fetch_document_text",
    {
      title: "Fetch Full Judgment Text",
      description:
        "Fetch full text for a legislation or case URL (AustLII or jade.io), with OCR fallback for scanned PDFs. Supports paragraph blocks with [N] markers. Optional citeKey stores to cache.",
      inputSchema: fetchDocumentShape,
    },
    async (rawInput) => {
      const { url, format, citeKey } = fetchDocumentParser.parse(rawInput);
      const response = await fetchDocumentText(url);
      if (config.sources.fetchByDefault && citeKey) {
        try {
          const existing = await getCitation(config.cache.dir, citeKey);
          const storeResult = await storeSource(
            citeKey, url, existing, config.sources.dir, response,
          );
          const relPath = path.relative(config.cache.dir, storeResult.path);
          await updateSourceFields(config.cache.dir, citeKey, {
            sourceFile: relPath,
            contentHash: storeResult.contentHash,
            sourceFetchedAt: new Date().toISOString(),
            sourceEtag: storeResult.etag,
            sourceLastModified: storeResult.lastModified,
          });
        } catch {
          // Best-effort
        }
      }
      return formatFetchResponse(response, format ?? "json");
    },
  );

  // ── resolve_jade_article ──────────────────────────────────────────────
  const resolveJadeArticleShape = {
    articleId: z.number().int().min(1, "Article ID must be positive."),
  };
  const resolveJadeArticleParser = z.object(resolveJadeArticleShape);

  server.registerTool(
    "resolve_jade_article",
    {
      title: "Resolve jade.io Article",
      description:
        "Resolve metadata for a jade.io article by numeric ID. Returns case name, neutral citation, jurisdiction, and year.",
      inputSchema: resolveJadeArticleShape,
    },
    async (rawInput) => {
      const { articleId } = resolveJadeArticleParser.parse(rawInput);
      const article = await resolveArticle(articleId);
      return {
        content: [{ type: "text", text: JSON.stringify(article, null, 2) }],
      };
    },
  );

  // ── jade_citation_lookup ──────────────────────────────────────────────
  const jadeLookupShape = {
    citation: z.string().min(1, "Citation cannot be empty."),
  };
  const jadeLookupParser = z.object(jadeLookupShape);

  server.registerTool(
    "jade_citation_lookup",
    {
      title: "Generate jade.io Citation Lookup URL",
      description:
        "Generate a jade.io search URL for a neutral citation (e.g. '[2008] NSWSC 323'). Opens jade.io with the citation pre-searched.",
      inputSchema: jadeLookupShape,
    },
    async (rawInput) => {
      const { citation } = jadeLookupParser.parse(rawInput);
      const lookupUrl = buildCitationLookupUrl(citation);
      return {
        content: [{ type: "text", text: JSON.stringify({ citation, jadeUrl: lookupUrl }, null, 2) }],
      };
    },
  );

  // ── format_citation ───────────────────────────────────────────────────
  const formatCitationShape = {
    title: z.string().min(1).describe("Case name, e.g. 'Mabo v Queensland (No 2)'"),
    neutralCitation: z.string().optional().describe("Neutral citation, e.g. '[1992] HCA 23'"),
    reportedCitation: z.string().optional().describe("Reported citation, e.g. '(1992) 175 CLR 1'"),
    pinpoint: z.string().optional().describe("Pinpoint reference, e.g. '[20]'"),
    style: z.enum(["neutral", "reported", "combined"]).default("combined"),
  };
  const formatCitationParser = z.object(formatCitationShape);

  server.registerTool(
    "format_citation",
    {
      title: "Format AGLC4 Citation",
      description:
        "Format an Australian case citation per AGLC4 rules. Combines case name, neutral citation, reported citation, and optional pinpoint.",
      inputSchema: formatCitationShape,
    },
    async (rawInput) => {
      const { title, neutralCitation, reportedCitation, pinpoint, style } =
        formatCitationParser.parse(rawInput);
      const formatted = formatAGLC4({
        title,
        neutralCitation: style !== "reported" ? neutralCitation : undefined,
        reportedCitation: style !== "neutral" ? reportedCitation : undefined,
        pinpoint,
      });
      return { content: [{ type: "text", text: formatted }] };
    },
  );

  // ── validate_citation ─────────────────────────────────────────────────
  const validateCitationShape = {
    citation: z.string().min(1).describe("Neutral citation to validate, e.g. '[1992] HCA 23'"),
  };
  const validateCitationParser = z.object(validateCitationShape);

  server.registerTool(
    "validate_citation",
    {
      title: "Validate Citation Against AustLII",
      description:
        "Validate a neutral citation by checking it exists on AustLII. Returns canonical URL if valid.",
      inputSchema: validateCitationShape,
    },
    async (rawInput) => {
      const { citation } = validateCitationParser.parse(rawInput);
      const result = await validateCitation(citation);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── generate_pinpoint ─────────────────────────────────────────────────
  const generatePinpointShape = {
    url: z.string().url().describe("AustLII document URL to fetch and search"),
    paragraphNumber: z.number().int().positive().optional().describe("Paragraph number to locate"),
    phrase: z.string().min(1).optional().describe("Phrase to search within paragraphs"),
    caseCitation: z.string().optional().describe("Case citation to prepend, e.g. '[2022] FedCFamC2F 786'"),
  };
  const generatePinpointParser = z
    .object(generatePinpointShape)
    .refine(
      (d) => d.paragraphNumber !== undefined || d.phrase !== undefined,
      "Provide at least one of paragraphNumber or phrase",
    );

  server.registerTool(
    "generate_pinpoint",
    {
      title: "Generate Pinpoint Citation",
      description:
        "Fetch a judgment from AustLII and generate a pinpoint citation to a specific paragraph (by number or phrase search).",
      inputSchema: generatePinpointShape,
    },
    async (rawInput) => {
      const { url, paragraphNumber, phrase, caseCitation } = generatePinpointParser.parse(rawInput);
      const doc = await fetchDocumentText(url);
      if (!doc.paragraphs || doc.paragraphs.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No paragraph blocks found" }) }] };
      }
      const pinpoint = generatePinpoint(doc.paragraphs, { paragraphNumber, phrase });
      if (!pinpoint) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Paragraph not found" }) }] };
      }
      const fullCitation = caseCitation
        ? `${caseCitation} ${pinpoint.pinpointString}`
        : pinpoint.pinpointString;
      return { content: [{ type: "text", text: JSON.stringify({ ...pinpoint, fullCitation }, null, 2) }] };
    },
  );

  // ── search_by_citation ────────────────────────────────────────────────
  const searchByCitationShape = {
    citation: z.string().min(1).describe("Citation to search for, e.g. '[1992] HCA 23' or 'Mabo v Queensland'"),
    format: formatEnum.optional(),
  };
  const searchByCitationParser = z.object(searchByCitationShape);

  server.registerTool(
    "search_by_citation",
    {
      title: "Search by Citation",
      description:
        "Find a case by its citation. If a neutral citation is detected, validates it against AustLII and returns the direct URL. Otherwise performs a case name search.",
      inputSchema: searchByCitationShape,
    },
    async (rawInput) => {
      const { citation, format } = searchByCitationParser.parse(rawInput);
      const parsed = parseCitation(citation);
      if (parsed?.neutralCitation) {
        const validated = await validateCitation(parsed.neutralCitation);
        if (validated.valid && validated.austliiUrl) {
          const result: SearchResult = {
            title: citation,
            neutralCitation: parsed.neutralCitation,
            url: validated.austliiUrl,
            source: "austlii",
            type: "case",
          };
          return formatSearchResults([result], format ?? "json");
        }
      }
      const results = await searchAustLii(citation, {
        type: "case", sortBy: "relevance", limit: 5,
      });
      return formatSearchResults(results, format ?? "json");
    },
  );

  // ── search_citing_cases ───────────────────────────────────────────────
  const searchCitingCasesShape = {
    caseName: z.string().min(1).describe("Case name or citation, e.g. 'Mabo v Queensland (No 2)' or '[1992] HCA 23'"),
    format: formatEnum.optional(),
  };
  const searchCitingCasesParser = z.object(searchCitingCasesShape);

  server.registerTool(
    "search_citing_cases",
    {
      title: "Search Citing Cases (Citator)",
      description:
        "Find cases that cite a given case on jade.io. Requires JADE_SESSION_COOKIE. Returns citing cases with neutral citations and total count.",
      inputSchema: searchCitingCasesShape,
    },
    async (rawInput) => {
      const { caseName, format } = searchCitingCasesParser.parse(rawInput);
      const { results, totalCount } = await searchCitingCases(caseName);
      const output = { totalCount, results };
      const fmt = format ?? "json";
      if (fmt === "json") {
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
      }
      const lines = [
        `**${results.length} of ${totalCount} citing cases found**`,
        ...results.map(
          (r) =>
            `- ${r.caseName} ${r.neutralCitation}${r.reportedCitation ? "; " + r.reportedCitation : ""} — ${r.jadeUrl}`,
        ),
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  // ── cache_citation ────────────────────────────────────────────────────
  const cacheCitationShape = {
    title: z.string().min(1).describe("Case name"),
    neutralCitation: z.string().optional().describe("Neutral citation"),
    reportedCitation: z.string().optional().describe("Reported citation"),
    url: z.string().url().describe("Primary source URL"),
    type: z.enum(["case", "legislation", "secondary", "treaty"]).default("case"),
    jurisdiction: z.string().optional(),
    year: z.number().int().optional().describe("Decision year"),
    court: z.string().optional().describe("Court code, e.g. 'HCA'"),
    keywords: z.array(z.string()).optional(),
    summary: z.string().optional(),
    document: z.string().optional().describe("Logical document this citation belongs to"),
    footnoteNumber: z.number().int().optional().describe("Footnote number"),
    pinpoint: z.string().optional().describe("Pinpoint for AGLC4 full form"),
    style: z.enum(["neutral", "reported", "combined"]).default("combined"),
  };
  const cacheCitationParser = z.object(cacheCitationShape);

  server.registerTool(
    "cache_citation",
    {
      title: "Cache Citation",
      description:
        "Store or update a citation in the local project cache. Assigns a biblatex-compatible cite key on first use.",
      inputSchema: cacheCitationShape,
    },
    async (rawInput) => {
      const input = cacheCitationParser.parse(rawInput);
      const aglc4Full = formatAGLC4({
        title: input.title,
        neutralCitation: input.style !== "reported" ? input.neutralCitation : undefined,
        reportedCitation: input.style !== "neutral" ? input.reportedCitation : undefined,
        pinpoint: input.pinpoint,
      });
      const citeKey = await upsertCitation(config.cache.dir, {
        ...input, aglc4Full,
      });
      return { content: [{ type: "text", text: JSON.stringify({ citeKey, aglc4Full }, null, 2) }] };
    },
  );

  // ── get_citation ──────────────────────────────────────────────────────
  const getCitationShape = {
    citeKey: z.string().min(1),
  };
  const getCitationParser = z.object(getCitationShape);

  server.registerTool(
    "get_citation",
    {
      title: "Get Cached Citation",
      description: "Retrieve a cached citation by its cite key.",
      inputSchema: getCitationShape,
    },
    async (rawInput) => {
      const { citeKey } = getCitationParser.parse(rawInput);
      const citation = await getCitation(config.cache.dir, citeKey);
      if (!citation) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Citation '${citeKey}' not found` }) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(citation, null, 2) }] };
    },
  );

  // ── list_citations ────────────────────────────────────────────────────
  const listCitationsShape = {
    document: z.string().optional().describe("Filter to a specific document name"),
  };
  const listCitationsParser = z.object(listCitationsShape);

  server.registerTool(
    "list_citations",
    {
      title: "List Cached Citations",
      description: "List all cached citations, optionally filtered by document name.",
      inputSchema: listCitationsShape,
    },
    async (rawInput) => {
      const { document } = listCitationsParser.parse(rawInput);
      const citations = await listCitations(config.cache.dir, document);
      return { content: [{ type: "text", text: JSON.stringify(citations, null, 2) }] };
    },
  );

  // ── export_bibliography ───────────────────────────────────────────────
  const exportBibShape = {
    document: z.string().optional().describe("Export citations for a specific document"),
  };
  const exportBibParser = z.object(exportBibShape);

  server.registerTool(
    "export_bibliography",
    {
      title: "Export Bibliography",
      description: "Export cached citations as BibLaTeX format.",
      inputSchema: exportBibShape,
    },
    async (rawInput) => {
      const { document } = exportBibParser.parse(rawInput);
      const output = await exportBib(config.cache.dir, document);
      return { content: [{ type: "text", text: output }] };
    },
  );

  // ── Normalise citation ────────────────────────────────────────────────
  const normaliseCitationShape = {
    citation: z.string().min(1),
  };
  const normaliseCitationParser = z.object(normaliseCitationShape);

  server.registerTool(
    "normalise_citation",
    {
      title: "Normalise Citation String",
      description: "Normalise a citation string to canonical form (lowercase, strip brackets, standardise spacing).",
      inputSchema: normaliseCitationShape,
    },
    async (rawInput) => {
      const { citation } = normaliseCitationParser.parse(rawInput);
      return { content: [{ type: "text", text: normaliseCitation(citation) }] };
    },
  );

  // ── Build AustLII URL from neutral citation ───────────────────────────
  const austliiUrlShape = {
    neutralCitation: z.string().min(1).describe("Neutral citation, e.g. '[1992] HCA 23'"),
  };
  const austliiUrlParser = z.object(austliiUrlShape);

  server.registerTool(
    "build_austlii_url",
    {
      title: "Build AustLII URL from Neutral Citation",
      description: "Derive an AustLII URL directly from a neutral citation without a network call.",
      inputSchema: austliiUrlShape,
    },
    async (rawInput) => {
      const { neutralCitation } = austliiUrlParser.parse(rawInput);
      const url = austliiUrlFromNeutral(neutralCitation);
      return { content: [{ type: "text", text: JSON.stringify({ neutralCitation, austliiUrl: url }) }] };
    },
  );

  return server;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const port = parseInt(process.env.LAIW_MCP_PORT ?? "0", 10);

  if (port > 0) {
    // HTTP mode
    const httpServer = createServer();
    httpServer.listen(port, () => {
      console.error(`[laiw-mcp] Listening on http://0.0.0.0:${port}`);
    });

    let currentTransport: StreamableHTTPServerTransport | null = null;

    httpServer.on("request", async (req, res) => {
      try {
        const server = createMcpServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        currentTransport = transport;
        await server.connect(transport);
        transport.onclose = () => {
          currentTransport = null;
        };
      } catch (err) {
        console.error("[laiw-mcp] HTTP transport error:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: "MCP server error" }));
      }
    });
  } else {
    // Stdio mode (default)
    const transport = new StdioServerTransport();
    const server = createMcpServer();
    await server.connect(transport);
    console.error("[laiw-mcp] Running in stdio mode");
  }
}

main().catch((err) => {
  console.error("[laiw-mcp] Fatal:", err);
  process.exit(1);
});

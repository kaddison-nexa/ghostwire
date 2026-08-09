// CISA's Known Exploited Vulnerabilities catalog: free, public, no API key.
// Everything in it is, by CISA's own inclusion criteria, a vulnerability with
// confirmed active exploitation — which is why every entry maps to our
// "critical" severity rather than something we're inferring ourselves.
const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

interface KevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string; // YYYY-MM-DD
  shortDescription: string;
}

export interface FeedItem {
  source: string;
  url: string;
  headline: string;
  summary: string;
  severity: "critical";
  publishedAt: string;
}

export async function fetchLatestKev(limit = 10): Promise<FeedItem[]> {
  const res = await fetch(KEV_URL);
  if (!res.ok) throw new Error(`CISA KEV feed request failed: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as { vulnerabilities: KevEntry[] };
  return data.vulnerabilities
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
    .slice(0, limit)
    .map((e) => ({
      source: "CISA KEV",
      url: `https://nvd.nist.gov/vuln/detail/${e.cveID}`,
      headline: `${e.vendorProject} ${e.product}: ${e.vulnerabilityName}`,
      summary: e.shortDescription,
      severity: "critical" as const,
      publishedAt: new Date(e.dateAdded).toISOString(),
    }));
}

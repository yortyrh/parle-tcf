export const DEFAULT_USER_AGENT =
  'parle-tcf-importer/1.0 (+exercise bank sync; one request per page)';

export type FetchResult =
  | { kind: 'ok'; html: string }
  | { kind: 'blocked'; status: number }
  | { kind: 'not_found'; status: number }
  | { kind: 'error'; status: number | null; message: string };

const BLOCKED = new Set([401, 403, 429, 503]);
const NOT_FOUND = new Set([404, 410]);

/**
 * One plain HTTP GET. No retries, no headless browser and no attempt to get around
 * bot protection: when the site refuses the request, the importer reports it and stops.
 */
export async function fetchPage(
  url: string,
  {
    fetchImpl = fetch,
    userAgent = DEFAULT_USER_AGENT,
  }: { fetchImpl?: typeof fetch; userAgent?: string } = {}
): Promise<FetchResult> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { 'User-Agent': userAgent, Accept: 'text/html' },
    });
  } catch (error) {
    return {
      kind: 'error',
      status: null,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (response.status >= 200 && response.status < 300) {
    return { kind: 'ok', html: await response.text() };
  }
  if (BLOCKED.has(response.status)) return { kind: 'blocked', status: response.status };
  if (NOT_FOUND.has(response.status)) return { kind: 'not_found', status: response.status };
  return {
    kind: 'error',
    status: response.status,
    message: `Unexpected HTTP status ${response.status}`,
  };
}

import { config } from '../config.js';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    /* ─── 1. recursion guard ───────────────────────────────── */
    if (request.headers.get('x-meta-worker') === 'done') {
      return fetch(request);            // skip second pass
    }
    /* ─────────────────────────────────────────────────────── */

    const domainSource = config.domainSource;
    const patterns     = config.patterns;

    const url      = new URL(request.url);
    const referer  = request.headers.get('Referer');

    /* helpers … (unchanged) */
    const getPatternConfig = (pathname: string) => {
      for (const p of patterns) {
        if (new RegExp(p.pattern).test(pathname + (pathname.endsWith('/') ? '' : '/'))) {
          return p;
        }
      }
      return null;
    };
    const isPageData = (pathname: string) =>
      /\/public\/data\/[a-f0-9-]{36}\.json/.test(pathname);

    /* fetch metadata helper (unchanged except return) */
    async function requestMetadata(pathname: string, endpoint: string) {
      const id  = pathname.replace(/\/$/, '').split('/').pop();
      const url = endpoint.replace(/{[^}]+}/, id!);
      const r   = await fetch(url, {
        headers: { Authorization: `Bearer ${env.SUPABASE_KEY}` },
      });
      if (!r.ok) throw new Error(`Metadata ${r.status}`);
      return r.json();
    }

    /* ───────────── 2. dynamic HTML branch ───────────── */
    const patternCfg = getPatternConfig(url.pathname);
    if (patternCfg) {
      const originResp = await fetch(domainSource + url.pathname);
      const cleanResp  = new Response(originResp.body, {
        status:  originResp.status,
        headers: originResp.headers,
      });
      cleanResp.headers.delete('X-Robots-Tag');

      const meta = await requestMetadata(url.pathname, patternCfg.metaDataEndpoint);
      const html = await new HTMLRewriter()
        .on('*', new CustomHeaderHandler(meta))
        .transform(cleanResp);

      html.headers.set('x-meta-worker', 'done');    // flag
      return html;
    }

    /* ───────────── 3. JSON page-data branch ─────────── */
    if (isPageData(url.pathname)) {
      const dataResp = await fetch(domainSource + url.pathname);
      const data     = await dataResp.json();

      const patternForJSON = referer && getPatternConfig(referer + (referer.endsWith('/') ? '' : '/'));
      if (patternForJSON) {
        const meta = await requestMetadata(referer!, patternForJSON.metaDataEndpoint);
        /* mutate `data` with meta … (same as your code) */
      }
      const jsonResp = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      jsonResp.headers.set('x-meta-worker', 'done'); // flag
      return jsonResp;
    }

    /* ───────────── 4. passthrough branch ────────────── */
    const passResp = await fetch(new Request(domainSource + url.pathname, request));
    const headers  = new Headers(passResp.headers);
    headers.delete('X-Robots-Tag');

    const finalResp = new Response(passResp.body, {
      status:  passResp.status,
      headers,
    });
    finalResp.headers.set('x-meta-worker', 'done');   // flag
    return finalResp;
  },
};

/* unchanged CustomHeaderHandler class … */

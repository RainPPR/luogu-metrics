// src/worker.ts

type ProblemItem = {
  type: string;
  difficulty: string | number;
};

type ProblemStats = {
  difficultyType: Record<string, Record<string, number>>;
  typeDifficulty: Record<string, Record<string, number>>;
  count: number;
};

const TYPE_LIST = ['ALL', 'P', 'B', 'CF', 'SP', 'AT', 'UVA'] as const;
const DIFFICULTY_LIST = ['ALL', '0', '1', '2', '3', '4', '5', '6', '7'] as const;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

function withCors(resp: Response): Response {
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }),
  );
}

function textResponse(text: string, status = 200): Response {
  return withCors(
    new Response(text, {
      status,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    }),
  );
}

function snippet(s: string, max = 600): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + ` ...[+${s.length - max} chars]` : s;
}

function randHex(nBytes = 16): string {
  const buf = new Uint8Array(nBytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fetchProblem(problemList: ProblemItem[] = []): ProblemStats {
  const difficultyType: Record<string, Record<string, number>> = {};
  const typeDifficulty: Record<string, Record<string, number>> = {};

  for (const d of DIFFICULTY_LIST) {
    if (d !== 'ALL') {
      difficultyType[d] = Object.fromEntries(TYPE_LIST.map((t) => [t, 0])) as Record<string, number>;
    }
  }
  for (const t of TYPE_LIST) {
    if (t !== 'ALL') {
      typeDifficulty[t] = Object.fromEntries(DIFFICULTY_LIST.map((d) => [d, 0])) as Record<string, number>;
    }
  }

  for (const problem of problemList) {
    const mtype = String(problem?.type ?? '');
    const difficulty = String(problem?.difficulty ?? '');

    if (!difficultyType[difficulty]) {
      difficultyType[difficulty] = Object.fromEntries(TYPE_LIST.map((t) => [t, 0])) as Record<string, number>;
    }
    if (!typeDifficulty[mtype]) {
      typeDifficulty[mtype] = Object.fromEntries(DIFFICULTY_LIST.map((d) => [d, 0])) as Record<string, number>;
    }

    if (difficultyType[difficulty]['ALL'] === undefined) difficultyType[difficulty]['ALL'] = 0;
    if (typeDifficulty[mtype]['ALL'] === undefined) typeDifficulty[mtype]['ALL'] = 0;

    difficultyType[difficulty][mtype] = (difficultyType[difficulty][mtype] ?? 0) + 1;
    typeDifficulty[mtype][difficulty] = (typeDifficulty[mtype][difficulty] ?? 0) + 1;

    difficultyType[difficulty]['ALL'] += 1;
    typeDifficulty[mtype]['ALL'] += 1;
  }

  return {
    difficultyType,
    typeDifficulty,
    count: problemList.length,
  };
}

type AttemptMeta = {
  type: 'contentOnly' | 'html';
  url: string;
  status: number;
  ok: boolean;
  redirected: boolean;
  contentType: string | null;
  bodyPreview: string;
  note?: string;
  code?: number;
  errorType?: string;
  errorMessage?: string;
  domain: string;
};

function isValidLuoguPayload(data: any): boolean {
  return !!(data && data.currentData && data.currentData.user);
}

function deepClone<T>(obj: T): T {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

function buildUserResult(data: any, uid: string) {
  const srcUser = data?.currentData?.user ?? {};
  const user = deepClone(srcUser);

  const delList = [
    'passedProblemCount',
    'submittedProblemCount',
    'elo',
    'eloValue',
    'badge',
    'slogan',
    'avatar',
    'isRoot',
    'blogAddress',
    'prize',
    'background',
    'introduction',
    'uid',
    'name',
  ];
  for (const key of delList) {
    if (key in user) delete (user as any)[key];
  }

  const rdata: any = {
    info: {
      uid,
      name: data?.currentData?.user?.name,
      avatar: data?.currentData?.user?.avatar,
      slogan: data?.currentData?.user?.slogan,
      badge: data?.currentData?.user?.badge,
    },
    user,
    elo: data?.currentData?.eloMax,
    passedProblem: null as ProblemStats | null,
    submittedProblem: null as ProblemStats | null,
  };

  if (data?.currentData && Array.isArray(data.currentData.passedProblems)) {
    console.log('[buildUserResult] passedProblems length:', data.currentData.passedProblems.length);
    rdata.passedProblem = fetchProblem(data.currentData.passedProblems as ProblemItem[]);
  } else if (data?.currentData && 'passedProblems' in data.currentData) {
    console.log('[buildUserResult] passedProblems present but not array, type:', typeof data.currentData.passedProblems);
    try {
      const arr = Array.from(data.currentData.passedProblems || []);
      rdata.passedProblem = fetchProblem(arr as ProblemItem[]);
    } catch {
      rdata.passedProblem = null;
    }
  } else {
    console.log('[buildUserResult] passedProblems not present');
  }

  if (data?.currentData && Array.isArray(data.currentData.submittedProblems)) {
    console.log('[buildUserResult] submittedProblems length:', data.currentData.submittedProblems.length);
    rdata.submittedProblem = fetchProblem(data.currentData.submittedProblems as ProblemItem[]);
  } else if (data?.currentData && 'submittedProblems' in data.currentData) {
    console.log('[buildUserResult] submittedProblems present but not array, type:', typeof data.currentData.submittedProblems);
    try {
      const arr = Array.from(data.currentData.submittedProblems || []);
      rdata.submittedProblem = fetchProblem(arr as ProblemItem[]);
    } catch {
      rdata.submittedProblem = null;
    }
  } else {
    console.log('[buildUserResult] submittedProblems not present');
  }

  return rdata;
}

function createLuoguHeaders(baseUrl: string, uid: string, kind: 'json' | 'html', clientId: string): HeadersInit {
  const headers: Record<string, string> = {
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': `${baseUrl}/user/${encodeURIComponent(uid)}`,
    'Origin': baseUrl,
    // 某些平台禁止覆盖 UA；尽量设置，但即使被忽略也无碍。
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    // 很多情况下 __client_id 必须存在，否则返回 418
    'Cookie': `__client_id=${clientId};`,
    // 这些头可以帮助模拟浏览器环境
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  };

  if (kind === 'json') {
    headers['Accept'] = 'application/json, text/plain, */*';
    headers['X-Requested-With'] = 'XMLHttpRequest';
    headers['x-luogu-type'] = 'content-only';
    // 不要为 GET 人为设置 Content-Type
  } else {
    headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
  }

  return headers;
}

async function doFetch(url: string, init: RequestInit, reqId: string): Promise<{ res: Response; preview: string; contentType: string | null }> {
  console.log(`[${reqId}] fetch ->`, url, 'init.headers:', init.headers);
  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type');
  const preview = await res.clone().text().then((t) => snippet(t)).catch(() => '[body read error]');
  console.log(`[${reqId}] fetch <- status=${res.status} ok=${res.ok} ct=${contentType} redirected=${res.redirected}`);
  console.log(`[${reqId}] body preview:`, preview);
  return { res, preview, contentType };
}

async function fetchContentOnly(baseUrl: string, uid: string, reqId: string): Promise<{ data: any | null; meta: AttemptMeta }> {
  const clientId = randHex(16); // 32 hex chars
  const url = `${baseUrl.replace(/\/+$/, '')}/user/${encodeURIComponent(uid)}?_contentOnly=1`;

  const headers = createLuoguHeaders(baseUrl, uid, 'json', clientId);
  // 控制台打印 Cookie（调试用），响应中不回显
  console.log(`[${reqId}] [contentOnly] using cookie:`, headers['Cookie']);

  const { res, preview, contentType } = await doFetch(url, { method: 'GET', headers }, reqId);

  let data: any = null;
  try {
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      // 有的场景会返回 text/html 包 JSON
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
  } catch (e) {
    console.error(`[${reqId}] [contentOnly] JSON parse error:`, (e as Error).message);
  }

  const meta: AttemptMeta = {
    type: 'contentOnly',
    url,
    status: res.status,
    ok: res.ok,
    redirected: res.redirected,
    contentType,
    bodyPreview: preview,
    domain: new URL(baseUrl).host,
  };

  if (data && typeof data === 'object') {
    if ('code' in data && typeof data.code === 'number') {
      meta.code = data.code;
    }
    if (data?.currentData?.errorType) meta.errorType = data.currentData.errorType;
    if (data?.currentData?.errorMessage) meta.errorMessage = data.currentData.errorMessage;
  }

  console.log(`[${reqId}] [contentOnly] valid=`, isValidLuoguPayload(data), 'code=', (data && data.code), 'errorType=', data?.currentData?.errorType);
  return { data, meta };
}

function tryExtractInjectionFromHtml(html: string, reqId: string): any | null {
  // 常见：window._feInjection = JSON.parse(decodeURIComponent("..."))
  // 1) 先尝试 JSON.parse(decodeURIComponent("..."))
  const re1 = /JSON\.parse\(decodeURIComponent\((['"])(.*?)\1\)\)/s;
  const m1 = html.match(re1);
  if (m1 && m1[2]) {
    try {
      const decoded = decodeURIComponent(m1[2]);
      console.log(`[${reqId}] [html] decodeURIComponent payload length:`, decoded.length);
      const data = JSON.parse(decoded);
      if (isValidLuoguPayload(data)) {
        console.log(`[${reqId}] [html] extracted via decodeURIComponent(JSON)`);
        return data;
      }
    } catch (e) {
      console.warn(`[${reqId}] [html] decode/parse failed:`, (e as Error).message);
    }
  }

  // 2) 兜底：window._feInjection = {...};
  const re2 = /window\._feInjection\s*=\s*(\{[\s\S]*?\})\s*;?/;
  const m2 = html.match(re2);
  if (m2 && m2[1]) {
    const raw = m2[1];
    console.log(`[${reqId}] [html] raw _feInjection snippet:`, snippet(raw, 300));
    try {
      const data = JSON.parse(raw);
      if (isValidLuoguPayload(data)) {
        console.log(`[${reqId}] [html] extracted via window._feInjection JSON`);
        return data;
      }
    } catch (e) {
      console.warn(`[${reqId}] [html] JSON parse _feInjection failed:`, (e as Error).message);
    }
  }

  console.log(`[${reqId}] [html] no recognizable injection found`);
  return null;
}

async function fetchFromHtml(baseUrl: string, uid: string, reqId: string): Promise<{ data: any | null; meta: AttemptMeta }> {
  const clientId = randHex(16);
  const url = `${baseUrl.replace(/\/+$/, '')}/user/${encodeURIComponent(uid)}`;
  const headers = createLuoguHeaders(baseUrl, uid, 'html', clientId);
  console.log(`[${reqId}] [html] using cookie:`, headers['Cookie']);

  const { res, preview, contentType } = await doFetch(url, { method: 'GET', headers }, reqId);
  const html = await res.clone().text().catch(() => '');
  const data = tryExtractInjectionFromHtml(html, reqId);

  const meta: AttemptMeta = {
    type: 'html',
    url,
    status: res.status,
    ok: res.ok,
    redirected: res.redirected,
    contentType,
    bodyPreview: preview,
    domain: new URL(baseUrl).host,
    note: data ? 'extracted from HTML' : 'failed to extract from HTML',
  };

  console.log(`[${reqId}] [html] valid=`, isValidLuoguPayload(data));
  return { data, meta };
}

type DomainPolicy = 'cn' | 'com' | 'auto';

function pickDomains(policy: DomainPolicy): string[] {
  if (policy === 'cn') return ['https://www.luogu.com.cn'];
  if (policy === 'com') return ['https://www.luogu.com'];
  return ['https://www.luogu.com', 'https://www.luogu.com.cn'];
}

async function fetchUserDataFlow(uid: string, policy: DomainPolicy, reqId: string) {
  const domains = pickDomains(policy);
  const trace: AttemptMeta[] = [];

  for (const baseUrl of domains) {
    console.log(`[${reqId}] trying domain: ${baseUrl}`);

    // 1) content-only JSON
    const a1 = await fetchContentOnly(baseUrl, uid, reqId);
    trace.push(a1.meta);
    if (isValidLuoguPayload(a1.data)) {
      console.log(`[${reqId}] success on content-only: ${baseUrl}`);
      return { data: a1.data, trace };
    }

    // 如果 content-only 返回 418 或结构不对，尝试 2) HTML 解析
    const a2 = await fetchFromHtml(baseUrl, uid, reqId);
    trace.push(a2.meta);
    if (isValidLuoguPayload(a2.data)) {
      console.log(`[${reqId}] success on HTML fallback: ${baseUrl}`);
      return { data: a2.data, trace };
    }

    console.warn(`[${reqId}] both content-only and HTML failed on domain: ${baseUrl}`);
  }

  console.error(`[${reqId}] all domains exhausted`);
  return { data: null as any, trace };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const reqId = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const ip = request.headers.get('cf-connecting-ip') || 'unknown-ip';

    console.log(`[req ${reqId}] ${method} ${url.pathname}${url.search} from ${ip}`);

    // CORS 预检
    if (method === 'OPTIONS') {
      console.log(`[req ${reqId}] OPTIONS preflight`);
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname === '/favicon.ico') {
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname === '/health') {
      return textResponse('ok');
    }

    const uid = (url.searchParams.get('uid') || '').trim();
    if (!uid) {
      console.log(`[req ${reqId}] missing uid`);
      return jsonResponse({ error: 'Missing uid', hint: 'Use /?uid=371511 or /?uid=371511&cn=true|false' }, 400);
    }

    // 参数策略：
    // cn=true -> 只用 .cn；cn=false -> 只用 .com；缺省 -> 自动 (.com -> .cn)
    const cnParam = (url.searchParams.get('cn') || '').toLowerCase();
    const policy: DomainPolicy =
      cnParam === 'true'
        ? 'cn'
        : cnParam === 'false'
        ? 'com'
        : 'auto';

    console.log(`[req ${reqId}] uid=${uid} policy=${policy} (raw cn=${cnParam || 'unset'})`);

    try {
      const t0 = Date.now();
      const { data, trace } = await fetchUserDataFlow(uid, policy, reqId);

      // 打印所有尝试的元数据
      for (const [i, m] of trace.entries()) {
        console.log(`[req ${reqId}] attempt ${i + 1}:`, {
          type: m.type,
          url: m.url,
          status: m.status,
          ok: m.ok,
          redirected: m.redirected,
          contentType: m.contentType,
          code: m.code,
          errorType: m.errorType,
          errorMessage: m.errorMessage,
          note: m.note,
        });
      }

      if (!data) {
        const resp = {
          error: 'Upstream did not return expected data',
          message: 'All attempts failed or returned unexpected structure.',
          trace,
        };
        console.error(`[req ${reqId}] failed in ${Date.now() - t0} ms`);
        return jsonResponse(resp, 502);
      }

      const result = buildUserResult(data, uid);
      console.log(
        `[req ${reqId}] success in ${Date.now() - t0} ms,` +
          ` name=${String(result.info.name)},` +
          ` passed=${result.passedProblem?.count ?? 0},` +
          ` submitted=${result.submittedProblem?.count ?? 0}`,
      );

      return jsonResponse(result);
    } catch (err) {
      console.error(`[req ${reqId}] exception:`, (err as Error).message);
      return jsonResponse({ error: 'Internal error', detail: (err as Error).message }, 500);
    }
  },
};
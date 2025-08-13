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

type FetchDebugMeta = {
  url: string;
  status: number;
  ok: boolean;
  redirected: boolean;
  contentType: string | null;
  bodyPreview: string;
};

async function fetchJsonWithDebug(url: string): Promise<{ data: any; meta: FetchDebugMeta }> {
  const headers: Record<string, string> = {
    // 尽量模拟浏览器请求，提升兼容性
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
  };

  // 设置合理的 Referer/Origin
  try {
    const u = new URL(url);
    headers['Origin'] = `${u.protocol}//${u.host}`;
    headers['Referer'] = `${u.protocol}//${u.host}/`;
  } catch {
    // ignore
  }

  console.log('[fetchJson] ->', url, 'headers:', headers);

  const res = await fetch(url, {
    method: 'GET',
    headers,
    // cf: { cacheEverything: false }, // 如需 Cloudflare 边缘缓存可开启
  });

  const ct = res.headers.get('content-type');
  const preview = await res.clone().text().then((t) => snippet(t)).catch(() => '[body read error]');
  const meta: FetchDebugMeta = {
    url,
    status: res.status,
    ok: res.ok,
    redirected: res.redirected,
    contentType: ct,
    bodyPreview: preview,
  };

  console.log('[fetchJson] <- status:', res.status, 'ct:', ct, 'redirected:', res.redirected);
  console.log('[fetchJson] body preview:', preview);

  let data: any = null;
  try {
    // 有些站点会用 text/html 返回 JSON，这里做双重兜底
    if (ct && ct.includes('application/json')) {
      data = await res.json();
    } else {
      const txt = await res.text();
      try {
        data = JSON.parse(txt);
      } catch {
        data = null;
      }
    }
  } catch (e) {
    console.error('[fetchJson] parse json failed:', (e as Error).message);
    data = null;
  }

  return { data, meta };
}

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

  if (data?.currentData && 'passedProblems' in data.currentData) {
    console.log('[buildUserResult] passedProblems length:', data.currentData.passedProblems?.length ?? 0);
    rdata.passedProblem = fetchProblem(data.currentData.passedProblems as ProblemItem[]);
  } else {
    console.log('[buildUserResult] passedProblems not present');
  }

  if (data?.currentData && 'submittedProblems' in data.currentData) {
    console.log('[buildUserResult] submittedProblems length:', data.currentData.submittedProblems?.length ?? 0);
    rdata.submittedProblem = fetchProblem(data.currentData.submittedProblems as ProblemItem[]);
  } else {
    console.log('[buildUserResult] submittedProblems not present');
  }

  return rdata;
}

async function fetchUserDataOnce(uid: string, baseUrl: string) {
  const url = `${baseUrl.replace(/\/+$/, '')}/user/${encodeURIComponent(uid)}?_contentOnly=1`;
  const started = Date.now();
  const { data, meta } = await fetchJsonWithDebug(url);
  console.log('[fetchUserDataOnce] ms:', Date.now() - started, 'valid:', isValidLuoguPayload(data));
  return { data, meta, baseUrl };
}

async function fetchUserDataSmart(uid: string, preferredBaseUrl: string) {
  // 先按首选域名请求，若无效则切换另一个域名再试
  const first = await fetchUserDataOnce(uid, preferredBaseUrl);

  if (isValidLuoguPayload(first.data)) {
    console.log('[fetchUserDataSmart] first attempt succeeded on', first.baseUrl);
    return { data: first.data, trace: [first.meta] };
  }

  const altBaseUrl =
    preferredBaseUrl.includes('.com.cn') || preferredBaseUrl.endsWith('.cn')
      ? 'https://www.luogu.com'
      : 'https://www.luogu.com.cn';

  console.warn('[fetchUserDataSmart] first attempt invalid, trying alt domain:', altBaseUrl);
  const second = await fetchUserDataOnce(uid, altBaseUrl);

  if (isValidLuoguPayload(second.data)) {
    console.log('[fetchUserDataSmart] second attempt succeeded on', second.baseUrl);
    return { data: second.data, trace: [first.meta, second.meta] };
  }

  console.error('[fetchUserDataSmart] both attempts invalid');
  return { data: null, trace: [first.meta, second.meta] };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const reqId = crypto.randomUUID();
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const uid = (url.searchParams.get('uid') || '').trim();
    const cnParam = url.searchParams.get('cn');

    console.log(`[req ${reqId}] ${method} ${url.pathname}${url.search} from ${request.headers.get('cf-connecting-ip') || 'unknown-ip'}`);

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

    if (!uid) {
      console.log(`[req ${reqId}] missing uid`);
      return jsonResponse({
        error: 'Missing uid',
        hint: 'Use /?uid=371511&cn=true',
      }, 400);
    }

    // 与原 worker.py 一致的优先域：默认 .com；cn=true 时优先 .cn
    const preferredBaseUrl = cnParam === 'true' ? 'https://www.luogu.com.cn' : 'https://www.luogu.com';
    console.log(`[req ${reqId}] uid=${uid} preferredBaseUrl=${preferredBaseUrl} (cn=${cnParam})`);

    try {
      const startedAll = Date.now();
      const { data, trace } = await fetchUserDataSmart(uid, preferredBaseUrl);

      // 输出调试 trace
      for (const [i, m] of trace.entries()) {
        console.log(`[req ${reqId}] attempt ${i + 1}:`, m);
      }

      if (!data) {
        const resp = {
          error: 'Upstream did not return expected data',
          message: 'Both domains failed or returned unexpected structure.',
          trace,
        };
        console.error(`[req ${reqId}] failed after ${Date.now() - startedAll} ms`);
        return jsonResponse(resp, 502);
      }

      const result = buildUserResult(data, uid);
      console.log(`[req ${reqId}] success in ${Date.now() - startedAll} ms,`
        + ` has name=${Boolean(result.info.name)},`
        + ` avatar=${Boolean(result.info.avatar)},`
        + ` elo=${result.elo},`
        + ` passedCount=${result.passedProblem?.count ?? 0},`
        + ` submittedCount=${result.submittedProblem?.count ?? 0}`);

      return jsonResponse(result);
    } catch (err) {
      console.error(`[req ${reqId}] exception:`, (err as Error).message);
      return jsonResponse(
        { error: 'Internal error', detail: (err as Error).message },
        500,
      );
    }
  },
};
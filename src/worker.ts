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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function fetchProblem(problemList: ProblemItem[]): ProblemStats {
  const difficultyType: Record<string, Record<string, number>> = {};
  const typeDifficulty: Record<string, Record<string, number>> = {};

  // 初始化 difficultyType（不含 ALL）
  for (const d of DIFFICULTY_LIST) {
    if (d !== 'ALL') {
      difficultyType[d] = Object.fromEntries(TYPE_LIST.map((t) => [t, 0])) as Record<string, number>;
    }
  }
  // 初始化 typeDifficulty（不含 ALL）
  for (const t of TYPE_LIST) {
    if (t !== 'ALL') {
      typeDifficulty[t] = Object.fromEntries(DIFFICULTY_LIST.map((d) => [d, 0])) as Record<string, number>;
    }
  }

  for (const problem of problemList ?? []) {
    const mtype = String(problem.type);
    const difficulty = String(problem.difficulty);

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
    count: problemList?.length ?? 0,
  };
}

async function fetchUserData(uid: string, baseUrl = 'https://www.luogu.com.cn') {
  const data = await fetchJson(`${baseUrl}/user/${encodeURIComponent(uid)}?_contentOnly=1`);
  const srcUser = data?.currentData?.user ?? {};

  // 深拷贝用户对象
  const user = JSON.parse(JSON.stringify(srcUser));

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
    if (key in user) delete user[key];
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
  };

  if ('passedProblems' in (data?.currentData ?? {})) {
    rdata.passedProblem = fetchProblem(data.currentData.passedProblems);
  } else {
    rdata.passedProblem = null;
  }

  if ('submittedProblems' in (data?.currentData ?? {})) {
    rdata.submittedProblem = fetchProblem(data.currentData.submittedProblems);
  } else {
    rdata.submittedProblem = null;
  }

  return rdata;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/favicon.ico') {
      return new Response('');
    }

    const uid = url.searchParams.get('uid');
    if (uid) {
      console.log(`Fetching data for user ${uid}...`);
      // 与原 worker.py 保持一致的默认域名逻辑
      const baseUrl = url.searchParams.get('cn') === 'true' ? 'https://www.luogu.com.cn' : 'https://www.luogu.com';

      try {
        const data = await fetchUserData(uid, baseUrl);
        console.log(`Data for user ${uid} fetched successfully.`);
        return jsonResponse(data);
      } catch (err) {
        console.error(`Failed to fetch data for user ${uid}`, err);
        return jsonResponse({ error: 'Failed to fetch user data' }, 500);
      }
    }

    return new Response('Hello world!');
  },
};
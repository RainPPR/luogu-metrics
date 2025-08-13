interface Env {}

async function fetch_json(url: string): Promise<any> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      'User-Agent': 'Mozilla/5.0',
      "Content-Type": "application/json"
    }
  });
  return await response.json();
}

function fetch_problem(problem_list: any[]): any {
  const type_list = ['ALL', 'P', 'B', 'CF', 'SP', 'AT', 'UVA'];
  const difficulty_list = ['ALL', '0', '1', '2', '3', '4', '5', '6', '7'];
  const difficultyType: Record<string, Record<string, number>> = {};
  for (const d of difficulty_list) {
    if (d !== 'ALL') {
      difficultyType[d] = {};
      for (const t of type_list) {
        difficultyType[d][t] = 0;
      }
    }
  }
  const typeDifficulty: Record<string, Record<string, number>> = {};
  for (const t of type_list) {
    if (t !== 'ALL') {
      typeDifficulty[t] = {};
      for (const d of difficulty_list) {
        typeDifficulty[t][d] = 0;
      }
    }
  }
  for (const problem of problem_list) {
    const mtype = problem['type'];
    const difficulty = String(problem['difficulty']);
    difficultyType[difficulty][mtype] += 1;
    typeDifficulty[mtype][difficulty] += 1;
    difficultyType[difficulty]['ALL'] += 1;
    typeDifficulty[mtype]['ALL'] += 1;
  }
  return {
    'difficultyType': difficultyType,
    'typeDifficulty': typeDifficulty,
    'count': problem_list.length
  };
}

async function fetch_user_data(uid: string, base_url: string = 'https://www.luogu.com.cn'): Promise<any> {
  const data = await fetch_json(`${base_url}/user/${uid}?_contentOnly=1`);
  let user = structuredClone(data['currentData']['user']);
  const del_list = [
    'passedProblemCount', 'submittedProblemCount', 'elo', 'eloValue', 'badge', 'slogan', 'avatar',
    'isRoot', 'blogAddress', 'prize', 'background', 'introduction', 'uid', 'name'
  ];
  for (const key of del_list) {
    if (key in user) {
      delete user[key];
    }
  }
  const rdata = {
    'info': {
      'uid': uid,
      'name': data['currentData']['user']['name'],
      'avatar': data['currentData']['user']['avatar'],
      'slogan': data['currentData']['user']['slogan'],
      'badge': data['currentData']['user']['badge'],
    },
    'user': user,
    'elo': data['currentData']['eloMax']
  };
  if ('passedProblems' in data['currentData']) {
    rdata['passedProblem'] = fetch_problem(data['currentData']['passedProblems']);
  } else {
    rdata['passedProblem'] = null;
  }
  if ('submittedProblems' in data['currentData']) {
    rdata['submittedProblem'] = fetch_problem(data['currentData']['submittedProblems']);
  } else {
    rdata['submittedProblem'] = null;
  }
  return rdata;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const uid = searchParams.get("uid");
    if (uid) {
      console.log(`Fetching data for user ${uid}...`);
      let base_url = 'https://www.luogu.com';
      if (searchParams.get("cn") === 'true') {
        base_url = 'https://www.luogu.com.cn';
      }
      const data = await fetch_user_data(uid, base_url);
      console.log(`Data for user ${uid} fetched successfully.`);
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url.pathname === "/favicon.ico") {
      return new Response("");
    }
    return new Response("Hello world!");
  },
};
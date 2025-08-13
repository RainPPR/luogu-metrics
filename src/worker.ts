// Define interfaces for our data structures to ensure type safety.

interface Problem {
  type: string;
  difficulty: number;
  pid: string;
}

interface Counts {
  [key: string]: number;
}

interface ProblemStats {
  difficultyType: { [difficulty: string]: Counts };
  typeDifficulty: { [type: string]: Counts };
  count: number;
}

interface LuoguUserData {
  currentData: {
    user: {
      uid: number;
      name: string;
      avatar: string;
      slogan: string;
      badge: string | null;
      ccfLevel: number;
      isBanned: boolean;
      isTester: boolean;
      color: string;
      // ... and other properties we will delete
      [key: string]: any; 
    };
    eloMax?: {
      rating: number;
      time: number;
    };
    passedProblems?: Problem[];
    submittedProblems?: Problem[];
  };
}

interface ResultData {
  info: {
    uid: number;
    name: string;
    avatar: string;
    slogan: string;
    badge: string | null;
  };
  user: {
    [key: string]: any; // The user object after deleting keys
  };
  elo: { rating: number; time: number; } | null;
  passedProblem: ProblemStats | null;
  submittedProblem: ProblemStats | null;
}

// Helper function to fetch and parse JSON from a URL.
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

// Processes a list of problems to generate statistics.
function fetchProblemStats(problemList: Problem[]): ProblemStats {
  const typeList = ['ALL', 'P', 'B', 'CF', 'SP', 'AT', 'UVA'];
  const difficultyList = ['ALL', '0', '1', '2', '3', '4', '5', '6', '7'];

  const difficultyType: { [difficulty: string]: Counts } = {};
  for (const d of difficultyList) {
    if (d !== 'ALL') {
      difficultyType[d] = Object.fromEntries(typeList.map(t => [t, 0]));
    }
  }

  const typeDifficulty: { [type: string]: Counts } = {};
  for (const t of typeList) {
    if (t !== 'ALL') {
      typeDifficulty[t] = Object.fromEntries(difficultyList.map(d => [d, 0]));
    }
  }

  for (const problem of problemList) {
    const mtype = problem.type;
    const difficulty = String(problem.difficulty);

    // Ensure the keys exist before incrementing
    if (difficultyType[difficulty] && typeDifficulty[mtype]) {
        difficultyType[difficulty][mtype]++;
        typeDifficulty[mtype][difficulty]++;

        difficultyType[difficulty]['ALL']++;
        typeDifficulty[mtype]['ALL']++;
    }
  }

  return {
    difficultyType,
    typeDifficulty,
    count: problemList.length,
  };
}

// Main function to fetch and process user data from Luogu.
async function fetchUserData(uid: string, baseUrl: string = 'https://www.luogu.com.cn'): Promise<ResultData> {
  const data = await fetchJson<LuoguUserData>(`${baseUrl}/user/${uid}?_contentOnly=1`);

  // Deep copy user object to avoid modifying the original
  const user = JSON.parse(JSON.stringify(data.currentData.user));
  
  const keysToDelete = [
    'passedProblemCount', 'submittedProblemCount',
    'elo', 'eloValue', 'badge', 'slogan', 'avatar',
    'isRoot', 'blogAddress', 'prize',
    'background', 'introduction', 'uid', 'name'
  ];

  for (const key of keysToDelete) {
    if (key in user) {
      delete user[key];
    }
  }
  
  const result: ResultData = {
    info: {
      uid: data.currentData.user.uid,
      name: data.currentData.user.name,
      avatar: data.currentData.user.avatar,
      slogan: data.currentData.user.slogan,
      badge: data.currentData.user.badge,
    },
    user: user,
    elo: data.currentData.eloMax || null,
    passedProblem: data.currentData.passedProblems 
      ? fetchProblemStats(data.currentData.passedProblems) 
      : null,
    submittedProblem: data.currentData.submittedProblems
      ? fetchProblemStats(data.currentData.submittedProblems)
      : null,
  };

  return result;
}

// Cloudflare Worker entry point
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { searchParams, pathname } = url;

    // Handle favicon requests
    if (pathname === "/favicon.ico") {
      return new Response("", { status: 204 });
    }

    const uid = searchParams.get("uid");

    if (uid) {
      console.log(`Fetching data for user ${uid}...`);
      try {
        const useCn = searchParams.get('cn') === 'true';
        const baseUrl = useCn ? 'https://www.luogu.com.cn' : 'https://www.luogu.com';
        
        const data = await fetchUserData(uid, baseUrl);
        console.log(`Data for user ${uid} fetched successfully.`);
        
        const jsonResponse = JSON.stringify(data, null, 2); // Pretty-print JSON
        
        return new Response(jsonResponse, {
          headers: {
            "Content-Type": "application/json;charset=UTF-8",
            "Access-Control-Allow-Origin": "*", // Allow cross-origin requests
          },
        });
      } catch (error) {
        console.error(`Error fetching data for UID ${uid}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return new Response(JSON.stringify({ error: "Failed to fetch user data.", details: errorMessage }), {
          status: 500,
          headers: {
            "Content-Type": "application/json;charset=UTF-8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // Default response
    return new Response("Hello! Please provide a user ID via the 'uid' query parameter. (e.g., ?uid=250374)", {
        headers: { "Content-Type": "text/plain;charset=UTF-8" }
    });
  },
};
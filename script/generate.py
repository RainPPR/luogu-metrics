import os
import common

def fetch_problem(problem_list):
    type_list = ['ALL', 'P', 'B', 'CF', 'SP', 'AT', 'UVA']
    difficulty_list = ['ALL', '0', '1', '2', '3', '4', '5', '6', '7']

    difficultyType = {d: {t: 0 for t in type_list} for d in difficulty_list if d != 'ALL'}
    typeDifficulty = {t: {d: 0 for d in difficulty_list} for t in type_list if t != 'ALL'}

    for problem in problem_list:
        mtype = problem['type']
        difficulty = str(problem['difficulty'])

        difficultyType[difficulty][mtype] += 1
        typeDifficulty[mtype][difficulty] += 1

        difficultyType[difficulty]['ALL'] += 1
        typeDifficulty[mtype]['ALL'] += 1

    return {
        'difficultyType': difficultyType,
        'typeDifficulty': typeDifficulty,
        'count': len(problem_list)
    }

def fetch_user_data(uid, base_url = 'https://www.luogu.com.cn'):
    data = common.fetch_json(f'{base_url}/user/{uid}?_contentOnly=1')
    user = data['currentData']['user'].copy()

    del_list = [
        'passedProblemCount', 'submittedProblemCount',
        'elo', 'eloValue', 'badge', 'slogan', 'avatar',
        'isRoot', 'blogAddress', 'prize',
        'background', 'introduction', 'uid', 'name'
    ]

    for key in del_list:
        if key in user:
            del user[key]

    rdata = {
        'info': {
            'uid': uid,
            'name': data['currentData']['user']['name'],
            'avatar': data['currentData']['user']['avatar'],
            'slogan': data['currentData']['user']['slogan'],
            'badge': data['currentData']['user']['badge'],
        },
        'user': user,
        'elo': data['currentData']['eloMax']
    }

    if 'passedProblems' in data['currentData']:
        rdata['passedProblem'] = fetch_problem(data['currentData']['passedProblems'])
    else:
        rdata['passedProblem'] = None

    if 'submittedProblems' in data['currentData']:
        rdata['submittedProblem'] = fetch_problem(data['currentData']['submittedProblems'])
    else:
        rdata['submittedProblem'] = None

    return rdata

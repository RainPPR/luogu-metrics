from workers import Response
from js import console
from urllib.parse import urlparse, parse_qs
from generate import fetch_user_data

async def on_fetch(request):
    url = urlparse(request.url)
    params = parse_qs(url.query)

    if "uid" in params:
        uid = params["uid"]
        console.log(f'Fetching data for user {uid}...')
        base_url = 'https://www.luogu.com'
        if 'cn' in params and params['cn'][0] == 'true':
            base_url = 'https://www.luogu.com.cn'
        data = await fetch_user_data(uid, base_url = base_url)
        console.log(f'Data for user {uid} fetched successfully.')
        return Response(data)

    if url.path == "/favicon.ico":
        return Response("")

    return Response("Hello world!")

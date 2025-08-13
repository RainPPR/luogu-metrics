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
        data = fetch_user_data(uid)
        console.log(f'Data for user {uid} fetched successfully.')
        return Response(data)

    if url.path == "/favicon.ico":
      return Response("")

    return Response("Hello world!")

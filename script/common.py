import urllib.request
import json
import http.cookiejar

def fetch_json(url: str):
    cookie_jar = http.cookiejar.CookieJar()
    cookie_handler = urllib.request.HTTPCookieProcessor(cookie_jar)
    opener = urllib.request.build_opener(cookie_handler)
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = opener.open(request)
    data = response.read().decode("utf-8")
    return json.loads(data)

def load_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)
    return data

def write_json(file_path, data):
    with open(file_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=4)

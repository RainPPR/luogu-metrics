import os
import common
import generate

if __name__ == '__main__':
    uid_list = common.load_json('uid.json')

    for uid in uid_list['uid_list']:
        print(f'Fetching data for user {uid}...')
        common.write_json(f'data/{uid}.json', generate.fetch_user_data(uid))
        print(f'Data for user {uid} fetched successfully.')
        print()

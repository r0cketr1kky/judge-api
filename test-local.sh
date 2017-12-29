#!/usr/bin/env bash

curl -L https://raw.githubusercontent.com/coding-blocks/judge-compose/master/docker-compose-withdb.yml > docker-compose.yml
curl -L https://raw.githubusercontent.com/coding-blocks/judge-compose/master/judgeapi-example.env > .env

docker build -t codingblocks/judge-api .
docker-compose -p judgecompose up -d

docker exec judgecompose_api_1 ./wait-for-it.sh api:3737 npm run seedlangs
docker exec -t --env JUDGEAPI_HOST=api --env JUDGEAPI_PORT=2222 judgecompose_api_1  npm run test

docker-compose kill
docker-compose down

rm docker-compose.yml
rm .env

docker system prune -f
docker volume prune -f
![mail-microservice](./logo.webp)

# Search Microservice

This microservice provides a RESTful API for managing and searching text data with synonym support. It includes endpoints for setting configurations, adding, updating, deleting, and searching text data.

The search functionality uses a combination of fuzzy matching and synonym matching to provide more comprehensive results.

## Example Search

Here are some example searches demonstrating the fuzzy matching and synonym support:

- Searching for `text` will match `text`.
- Searching for `Txt` will match `text`.
- Searching for `Tuxt` will match `text`.
- Searching for `automobile` will match `car`. (in case you add synonyms "automobile, car")

## Instalation

- Create `data` folder:

````bash
./init.sh
````

- Run server

```
docker compose up -d
```

## API Endpoints

### Set configuration

`POST /` + `body`

```json
{
    "synonyms": [
        ["word1, synonym word1, synonym word1"],
        ["word2, synonym word2, synonym word2"]
    ]
}
```

**Curl example:**

```bash
curl -X POST http://localhost:3000/ -H 'Content-Type: application/json' -d '{
    "synonyms": [
        ["word1, synonym word1, synonym word1"],
        ["word2, synonym word2, synonym word2"]
    ]
}'
```

### Get configuration 

`GET /`

**Curl example:**

```bash
curl -X GET http://localhost:3000/
```

### Add text data 

`POST /:index` + `body`

```json
{
    "id": ":indexId",
    "text": ["text data", "another text data"]
}
```

**Curl example:**

```bash
curl -X POST http://localhost:3000/news -H 'Content-Type: application/json' -d '{
    "id": 1,
    "text": ["text data", "another text data"]
}'
```

### Update text data

`PUT /:index/:indexId` + `body`

```json
{
    "text": ["new text data", "another text data"]
}
```

**Curl example:**

```bash
curl -X PUT http://localhost:3000/news/1 -H 'Content-Type: application/json' -d '{
    "text": ["new text data", "another text data"]
}'
```

### Delete text data

`DELETE /:index/:indexId`

**Curl example:**

```bash
curl -X DELETE http://localhost:3000/news/1
```

### Search

`GET /:index?search=word&page=1&size=10`

**Curl example:**
```bash
curl -X GET http://localhost:3000/news?search=word1&page=1&size=10
```

## Posible errors

## TOO_MANY_REQUESTS/12/disk usage exceeded

```
ResponseError: cluster_block_exception
	Root causes:
		cluster_block_exception: index [news] blocked by: [TOO_MANY_REQUESTS/12/disk usage exceeded flood-stage watermark, index has read-only-allow-delete block];
      at /home/ivanoff/work/search-microservice/node_modules/@elastic/transport/lib/Transport.js:543:27
      at processTicksAndRejections (native:1:1)
```

**FIX:**

```bash
curl -X PUT "http://localhost:3000/_cluster/settings" -H 'Content-Type: application/json' -d '{
  "persistent": {
    "cluster.routing.allocation.disk.watermark.low": "97%",
    "cluster.routing.allocation.disk.watermark.high": "98%",
    "cluster.routing.allocation.disk.watermark.flood_stage": "99%"
  }
}'
```
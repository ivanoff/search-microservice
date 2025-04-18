![Search Microservice](./logo.webp)

# Search Microservice

The **Search Microservice** provides a RESTful API for managing and searching text data, with built-in support for synonyms. It features endpoints for configuring settings, and for adding, updating, deleting, and searching text data.

The search functionality is powered by **Elasticsearch**, utilizing both fuzzy matching and synonym matching to deliver highly relevant and comprehensive search results. This enables flexible and intelligent search queries.

## Example

For `news` index: adding synonyms, text data and performing a search

```bash
curl -X POST http://localhost:3000/news/synonyms -H 'Content-Type: application/json' -d '{ "synonyms": ["title, subject"] }'

curl -X POST http://localhost:3000/news -H 'Content-Type: application/json' -d '{ "id": 1, "text": ["News title", "News detailed content"] }'

curl -X GET http://localhost:3000/news?search=subject
```

- [Search Microservice](#search-microservice)
  - [Example](#example)
      - [Search Result](#search-result)
  - [Example Searches](#example-searches)
  - [Installation](#installation)
    - [Initialize Data Folder](#initialize-data-folder)
    - [Start the Server:](#start-the-server)
  - [API Endpoints](#api-endpoints)
    - [Set Synonyms](#set-synonyms)
      - [Request Body](#request-body)
      - [Example Request](#example-request)
    - [Get Synonyms](#get-synonyms)
      - [Example Request](#example-request-1)
    - [Add Text Data](#add-text-data)
      - [Request Body](#request-body-1)
      - [Example Request](#example-request-2)
    - [Update Text Data](#update-text-data)
      - [Request Body](#request-body-2)
      - [Example Request](#example-request-3)
    - [Delete Text Data](#delete-text-data)
      - [Example Request](#example-request-4)
    - [Search](#search)
      - [Example Request](#example-request-5)
  - [Possible Errors](#possible-errors)
    - [`TOO_MANY_REQUESTS/12/disk usage exceeded`](#too_many_requests12disk-usage-exceeded)
      - [Solution:](#solution)


#### Search Result

```json
[
  {
    "_index": "news",
    "_type": "_doc",
    "_id": "1",
    "_score": 0.2876821,
    "_source": {
      "text": [
        "News title",
        "News detailed content"
      ]
    },
    "highlight": {
      "text": [
        "News **title**"
      ]
    }
  }
]
```

## Example Searches

Here are some examples that demonstrate the power of fuzzy matching and synonym support:

- Searching for `text` will match `text`.
- Searching for `Txt` will match `text`.
- Searching for `Tuxt` will match `text`.
- Searching for `automobile` will match `car`, provided the synonym `"automobile, car"` has been configured.

## Installation

To install and run the microservice:

```bash
git clone https://github.com/ivanoff/search-microservice.git
cd search-microservice
```

### Initialize Data Folder

```bash
./init.sh
```

### Start the Server:

```bash
docker compose up -d
```

## API Endpoints

### Set Synonyms

`POST /:index/synonyms`

Sets synonyms for the specified index.

#### Request Body

```json
{
  "synonyms": [
    "word1, synonym word1, synonym word1",
    "word2, synonym word2, synonym word2"
  ]
}
```

#### Example Request

```bash
curl -X POST http://localhost:3000/news/synonyms \
  -H 'Content-Type: application/json' \
  -d '{
    "synonyms": [
      "word1, synonym word1, synonym word1",
      "word2, synonym word2, synonym word2"
    ]
  }'
```

### Get Synonyms

`GET /:index/synonyms`

Retrieves the synonym configuration for the specified index.

#### Example Request

```bash
curl -X GET http://localhost:3000/news/synonyms
```

### Add Text Data

`POST /:index`

Adds new text data to the specified index.

#### Request Body

```json
{
  "id": ":indexId",
  "text": ["text data", "additional text data"]
}
```

#### Example Request

```bash
curl -X POST http://localhost:3000/news \
  -H 'Content-Type: application/json' \
  -d '{
    "id": 1,
    "text": ["text data", "additional text data"]
  }'
```

### Update Text Data

`PUT /:index/:indexId`

Updates the existing text data in the specified index.

#### Request Body

```json
{
  "text": ["updated text data", "more updated text data"]
}
```

#### Example Request

```bash
curl -X PUT http://localhost:3000/news/1 \
  -H 'Content-Type: application/json' \
  -d '{
    "text": ["updated text data", "more updated text data"]
  }'
```

### Delete Text Data

`DELETE /:index/:indexId`

Deletes text data from the specified index.

#### Example Request

```bash
curl -X DELETE http://localhost:3000/news/1
```

### Search

`GET /:index?search=word&page=1&size=10`

Performs a search on the specified index with pagination support.

#### Example Request

```bash
curl -X GET http://localhost:3000/news?search=word&page=1&size=10
```

## Possible Errors

### `TOO_MANY_REQUESTS/12/disk usage exceeded`

If you encounter an error like:

```bash
ResponseError: cluster_block_exception
	Root causes:
		cluster_block_exception: index [news] blocked by: [TOO_MANY_REQUESTS/12/disk usage exceeded flood-stage watermark, index has read-only-allow-delete block];
```

#### Solution:

You can resolve this issue by updating the Elasticsearch cluster settings:

```bash
curl -X PUT "http://localhost:9200/_cluster/settings" \
  -H 'Content-Type: application/json' \
  -d '{
    "persistent": {
      "cluster.routing.allocation.disk.watermark.low": "97%",
      "cluster.routing.allocation.disk.watermark.high": "98%",
      "cluster.routing.allocation.disk.watermark.flood_stage": "99%"
    }
  }'
```

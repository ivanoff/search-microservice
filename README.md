![Search Microservice](./logo.webp)

# Search Microservice

The **Search Microservice** provides a RESTful API for managing and searching text data, with built-in support for synonyms. It features endpoints for configuring settings, and for adding, updating, deleting, and searching text data.

The search functionality is powered by **Elasticsearch**, utilizing both fuzzy matching and synonym matching to deliver highly relevant and comprehensive search results. This enables flexible and intelligent search queries.

## Example

For `news` index: adding synonyms, text data and performing a search

```bash
curl -X POST http://localhost:3000/news/synonyms -H 'Content-Type: application/json' -d '{ "synonyms": ["title, subject"] }'

curl -X POST http://localhost:3000/news -H 'Content-Type: application/json' -d '{ "id": 1, "title": "News title", "content": "News detailed content", category_id: 2 }'

curl -X GET 'http://localhost:3000/news?_title=subject&category_id=2'
```

To `search by match`, you need to add `_` before the key name (for example, `_title`)

- [Search Microservice](#search-microservice)
  - [Example](#example)
      - [Search Result](#search-result)
  - [Example Searches](#example-searches)
  - [Run Search Microservice](#run-search-microservice)
    - [.env file](#env-file)
    - [Docker Compose](#docker-compose)
      - [Initialize Data Folder](#initialize-data-folder)
      - [Start the Server](#start-the-server)
    - [Kubernetes](#kubernetes)
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
    - [Search with JSON Body](#search-with-json-body)
      - [Example Request](#example-request-6)
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

## Run Search Microservice

### .env file

Create a `.env` file in the root directory of the project. This file will contain the configuration for the Elasticsearch connection.

```env
TOKEN=<SERVICE_TOKEN_HERE(OPTIONAL)>

ELASTIC_NODE=<URL_TO_ELASTICSEARCH>
ELASTIC_PASSWORD=<PASSWORD_TO_ELASTICSEARCH>
```

### Docker Compose

To install and run the microservice:

```bash
git clone https://github.com/ivanoff/search-microservice.git
cd search-microservice
```

#### Initialize Data Folder

```bash
./init.sh
```

#### Start the Server

```bash
docker compose up -d
```

### Kubernetes

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elasticsearch-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      containers:
      - name: elasticsearch
        image: docker.elastic.co/elasticsearch/elasticsearch:8.15.3
        ports:
          - containerPort: 9200
          - containerPort: 9300
        envFrom:
        - secretRef:
            name: elasticsearch-secrets
        volumeMounts:
        - name: elastic-storage
          mountPath: /usr/share/elasticsearch/data
      volumes:
      - name: elastic-storage
        hostPath:
          path: /opt/search-microservice/data/elastic

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: search-microservice-api-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: search-microservice-api
  template:
    metadata:
      labels:
        app: search-microservice-api
    spec:
      containers:
      - name: search-microservice-api
        image: onmvp/search-microservice:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: search-microservice-api-secrets

---
apiVersion: v1
kind: Service
metadata:
  name: elasticsearch-service
spec:
  type: LoadBalancer
  selector:
    app: elasticsearch
  ports:
    - name: http
      protocol: TCP
      port: 9200
      targetPort: 9200
    - name: transport
      protocol: TCP
      port: 9300
      targetPort: 9300

---
apiVersion: v1
kind: Service
metadata:
  name: search-microservice-api-service
spec:
  type: LoadBalancer
  selector:
    app: search-microservice-api
  ports:
    - name: search-microservice-api
      protocol: TCP
      port: 3000
      targetPort: 3000
```

## API Endpoints

- If `TOKEN` is set in the `.env` file, you need to add `Authorization` header with the token value to all requests (f.e. -H 'Authorization: <SERVICE_TOKEN_HERE>').

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

`GET /:index?_text=word&page=1&size=10`

Performs a search on the specified index with pagination support.

#### Example Request

```bash
curl -X GET http://localhost:3000/news?_text=word&page=1&size=10
```

### Search with JSON Body

`POST /:index/search` + `application/json body`

#### Example Request

```bash
curl -X POST http://localhost:3000/news/search \
  -H 'Content-Type: application/json' \
  -d '{
    "_text": "word",
    "id": [1, 4, 10],
    "page": 1,
    "size": 10
  }'
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

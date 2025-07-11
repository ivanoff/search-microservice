import 'the-log';
import { Hono } from 'hono';
import SearchService from "./search-service";
import { version } from "../package.json";

const {
    TOKEN,
    ELASTIC_NODE: node = 'http://localhost:9200',
    ELASTIC_USER: username,
    ELASTIC_PASSWORD: password,
    ELASTIC_API_KEY: apiKey,
    ELASTIC_BEARER: bearer,
    ELASTIC_REJECT_UNAUTHORIZED: rejectUnauthorizedStr,
    ELASTIC_COMPRESSION: compression,
} = process.env;

console.log(`Search Microservice v.${version} MIT License`);
console.log(`Created by Dimitry Ivanov <2@ivanoff.org.ua> # curl -A cv ivanoff.org.ua`);

const rejectUnauthorized = rejectUnauthorizedStr === 'true';
const searchService = new SearchService({ node, username, password, apiKey, bearer, rejectUnauthorized, compression });
await searchService.init();

async function checkTokenHandler(c, next) {
    const token = c.req.header('Authorization');
    if (TOKEN && TOKEN !== token) return c.json({ message: 'Unauthorized' }, 401);
    await next();
}

async function checkIndexHandler(c, next) {
    const { index } = c.req.param();
    if (index && !searchService.indexes[`${index}`]) return c.json({ message: `Index ${index} not found` }, 403);
    await next();
}

async function getSynonymsHandler(c) {
    const { index } = c.req.param();
    console.log('getSynonymsHandler', { synonyms: searchService.synonyms });
    return c.json({ synonyms: searchService.synonyms, index });
}

async function updateSynonymsHandler(c) {
    const { index } = c.req.param();
    const req = await c.req.json()
    console.log('updateSynonymsHandler', { ...req, index });
    return c.json(await searchService.updateSynonyms({ ...req, index }));
}

async function saveDocumentHandler(c) {
    const { index } = c.req.param();
    const { id, ...data } = await c.req.json();
    console.log('SAVE', { index, id, data });
    const dataArr: any[] = [].concat(data).filter(Boolean);
    const result: any = [];
    for (const d of dataArr) {
        result.push(await searchService.saveDocument({ index, id, ...d }));
    }
    return c.json(result);
}

async function updateDocumentHandler(c) {
    const { index, id, ...data } = await c.req.json();
    return c.json(await searchService.updateDocument({ index, id, ...data }));
}

async function deleteDocumentHandler(c) {
    const { index, id } = c.req.param();
    console.log('DELETE', { index, id });
    return c.json(await searchService.deleteDocument({ index, id }));
}

async function searchDocumentsHandler(c) {
    const { index } = c.req.param();
    const allQuery = c.req.query() || {};
    const body = c.req.method === 'POST' ? await c.req.json() : {};
    console.log('SEARCH', { index, allQuery, body });

    const { page: pageQuery, size: sizeQuery, sort, ...query } = { ...allQuery, ...body };
    const page = parseInt(pageQuery) || 1;
    const size = parseInt(sizeQuery) || 10;

    const result = await searchService.searchDocuments({
        index,
        from: (page - 1) * size,
        size,
        sort,
        ...query,
    });

    return c.json(result);
}

async function deleteIndexHandler(c) {
    const { index } = c.req.param();
    console.log('DELETE INDEX', { index });
    const response = await searchService.deleteIndex(index);
    if (response.ok) {
        return c.json({ message: `Index ${index} deleted successfully` });
    } else {
        return c.json({ message: `Failed to delete index ${index}` }, 500);
    }
}

const app = new Hono()

app.use('*', checkTokenHandler);

app.get('/:index', checkIndexHandler);
app.delete('/:index', checkIndexHandler);
app.put('/:index/:id', checkIndexHandler);

app.get('/:index/synonyms', getSynonymsHandler);
app.post('/:index/synonyms', updateSynonymsHandler);
app.post('/:index', saveDocumentHandler);
app.put('/:index/:id', updateDocumentHandler);
app.delete('/:index/:id', deleteDocumentHandler);
app.get('/:index', searchDocumentsHandler);
app.post('/:index/search', searchDocumentsHandler);
app.delete('/:index', deleteIndexHandler);

app.get('/', (c) => {
    return c.json({
        message: 'Search Microservice',
        version,
    });
});

app.onError((error, c) => {
    console.error(error);
    return c.json({ message: 'Internal Server Error', error }, 500);
});

export default app;

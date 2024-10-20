import { Hono } from 'hono';
import SearchService from "./search-service";

const {
  TOKEN,
  ELASTIC_NODE,
} = process.env;

const searchService = new SearchService(ELASTIC_NODE);

async function checkTokenHandler(c, next) {
    const token = c.req.header('Authorization');
    if (TOKEN && TOKEN !== token) return c.json({ message: 'Unauthorized' }, 401);
    await next();
}

async function getSynonymsHandler(c) {
    return c.json({ synonyms: searchService.synonyms });
}

async function updateSynonymsHandler(c) {
    return c.json(await searchService.updateSynonyms(await c.req.json()));
}

async function saveDocumentHandler(c) {
    const { index } = c.req.param();
    const { id, text } = await c.req.json();
    return c.json(await searchService.saveDocument({ index, id, text }));
}

async function updateDocumentHandler(c) {
    const { index, id, text } = await c.req.json();
    return c.json(await searchService.updateDocument({ index, id, text }));
}

async function deleteDocumentHandler(c) {
    const { index, id } = await c.req.json();
    return c.json(await searchService.deleteDocument({ index, id }));
}

async function searchDocumentsHandler(c) {
    const { index } = c.req.param();
    const search = c.req.query('search') || '';
    const page = parseInt(c.req.query('page') || '1');
    const size = parseInt(c.req.query('size') || '10');

    const result = await searchService.searchDocuments({
        index,
        text: search,
        from: (page - 1) * size,
        size,
    });

    return c.json(result);
}

const app = new Hono()

app.use('*', checkTokenHandler);

app.get('/', getSynonymsHandler);
app.post('/', updateSynonymsHandler);
app.post('/:index', saveDocumentHandler);
app.put('/:index/:id', updateDocumentHandler);
app.delete('/:index/:id', deleteDocumentHandler);
app.get('/:index', searchDocumentsHandler);

export default app;

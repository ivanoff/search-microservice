import { Client as ElasticClient, HttpConnection } from '@elastic/elasticsearch';
import type { MappingDynamicTemplate, MappingProperty } from '@elastic/elasticsearch/lib/api/types';

const DEFAULT_DYNAMIC_TEMPLATES: Record<string, MappingDynamicTemplate>[] = [
    {
        strings_as_text: {
            match_mapping_type: 'string',
            mapping: {
                type: 'text',
                fields: {
                    keyword: {
                        type: 'keyword',
                        ignore_above: 256,
                    },
                },
            } as MappingProperty,
        },
    },
];

const BASE_PROPERTIES: Record<string, MappingProperty> = {
    text: {
        type: 'text',
        analyzer: 'default_analyzer',
        search_analyzer: 'synonym_search_analyzer',
    } as MappingProperty,
    text_synonyms: {
        type: 'text',
        analyzer: 'synonym_analyzer',
    } as MappingProperty,
};

class SearchService {
    private client: ElasticClient;
    private node: string;
    private username?: string;
    private password?: string;
    private apiKey?: string;
    private bearer?: string;
    private rejectUnauthorized?: boolean;
    private compression?: string;
    private sortFieldCache: Map<string, { field: string; unmappedType?: string } | null> = new Map();
    public indexes: Record<string, boolean> = {};
    public synonyms: string[] = [];

    constructor({ node, username, password, apiKey, bearer, rejectUnauthorized, compression }: SearchServiceOptions) {
        this.node = node;
        this.username = username || (password ? 'elastic' : undefined);
        this.password = password;
        this.apiKey = apiKey;
        this.bearer = bearer;
        this.rejectUnauthorized = rejectUnauthorized;
        this.compression = compression;
    }

    public async init() {
        let auth;
        if (this.username) {
            auth = { username: this.username, password: this.password };
        } else if (this.apiKey) {
            auth = { apiKey: this.apiKey };
        } else if (this.bearer) {
            auth = { bearer: this.bearer };
        }

        while (true) {
            try {
                this.client = new ElasticClient({
                    Connection: HttpConnection,
                    node: this.node,
                    auth,
                    ...(this.rejectUnauthorized && { tls: { rejectUnauthorized: this.rejectUnauthorized } }),
                    ...(this.compression && { compression: this.compression === 'true' }),
                });
                await this.client.ping();
                console.log('Connection with ElasticSearch established', this.node);
                break;
            } catch (error) {
                console.log('Connection with ElasticSearch failed, retrying in 5 seconds...', this.node, error);
                await Bun.sleep(5000);
            }
        }

        const res = await this.client.cat.indices({ format: 'json' });

        res.forEach((index: any) => {
            if (index.index) this.indexes[index.index] = true;
        });
    }

    private async ensureBaseMapping(index: string) {
        const current: any = await this.client.indices.getMapping({ index });
        const properties = current?.[index]?.mappings?.properties || {};
        const missing: Record<string, any> = {};

        if (!properties.text) missing.text = BASE_PROPERTIES.text;
        if (!properties.text_synonyms) missing.text_synonyms = BASE_PROPERTIES.text_synonyms;

        if (Object.keys(missing).length) {
            await this.client.indices.putMapping({
                index,
                body: { properties: missing },
            });
        }
    }

    async createNewIndexWithSynonyms(index: string) {
        const exists = await this.client.indices.exists({ index });
        if (exists) {
            this.indexes[index] = true;
            return true;
        }

        await this.client.indices.create({
            index,
            body: {
                settings: {
                    analysis: {
                        filter: {
                            synonym_filter: {
                                type: 'synonym',
                                synonyms: [],
                            },
                        },
                        analyzer: {
                            synonym_analyzer: {
                                type: 'custom',
                                tokenizer: 'standard',
                                filter: ['lowercase', 'synonym_filter'],
                            },
                            synonym_search_analyzer: {
                                type: 'custom',
                                tokenizer: 'standard',
                                filter: ['lowercase', 'synonym_filter'],
                            },
                            default_analyzer: {
                                type: 'standard',
                            },
                        },
                    },
                },
                mappings: {
                    numeric_detection: true,
                    dynamic_templates: DEFAULT_DYNAMIC_TEMPLATES,
                    properties: BASE_PROPERTIES,
                },
            },
        });

        this.indexes[index] = true;

        return true;
    }

    private async resolveSortField(index: string, field: string) {
        const cacheKey = `${index}:${field}`;
        if (this.sortFieldCache.has(cacheKey)) {
            return this.sortFieldCache.get(cacheKey);
        }

        try {
            const caps: any = await this.client.fieldCaps({
                index,
                fields: [field, `${field}.keyword`],
                include_unmapped: true,
            });

            const keywordCaps = caps?.fields?.[`${field}.keyword`];
            if (keywordCaps && Object.keys(keywordCaps).length > 0) {
                const resolved = { field: `${field}.keyword`, unmappedType: 'keyword' };
                this.sortFieldCache.set(cacheKey, resolved);
                return resolved;
            }

            const baseCaps = caps?.fields?.[field];
            if (baseCaps && Object.keys(baseCaps).length > 0) {
                const baseType = Object.keys(baseCaps)[0];
                if (baseType !== 'text') {
                    const resolved = { field, unmappedType: baseType };
                    this.sortFieldCache.set(cacheKey, resolved);
                    return resolved;
                }
            }
        } catch (error) {
            // ignore and fall through to cache null
        }

        this.sortFieldCache.set(cacheKey, null);
        return null;
    }

    async saveDocument({ index, id, ...data }: Document) {
        if (!this.indexes[index]) await this.createNewIndexWithSynonyms(index);

        const response = await this.client.index({
            index,
            id,
            body: {
                // text_synonyms: text,
                id,
                ...data,
            }
        });

        return response;
    }

    async updateDocument({ index, id, ...data }: Document) {
        const response = await this.client.update({
            index,
            id,
            body: {
                doc: {
                    // text_synonyms: text,
                    id,
                    ...data,
                }
            }
        });

        return response;
    }

    async deleteDocument({ index, id }: BaseDocument) {
        const response = await this.client.deleteByQuery({
            index,
            body: {
                query: {
                    bool: {
                        must: [
                            { term: { _id: id } }
                        ]
                    }
                }
            },
            refresh: true,
        });

        return response;
    }

    async deleteIndex(index: string) {
        if (!this.indexes[index]) return { ok: false, error: 'Index does not exist' };

        const response = await this.client.indices.delete({ index });

        if (response.acknowledged) {
            delete this.indexes[index];
            return { ok: true };
        } else {
            return { ok: false, error: 'Failed to delete index' };
        }
    }

    async updateSynonyms({ index, synonyms }: updateSynonyms) {
        if (!this.indexes[index]) await this.createNewIndexWithSynonyms(index);
        await this.client.indices.close({ index });

        await this.client.indices.putSettings({
            index,
            body: {
                settings: {
                    analysis: {
                        filter: {
                            synonym_filter: {
                                type: 'synonym',
                                updateable: true,
                                synonyms,
                            },
                        },
                        analyzer: {
                            synonym_analyzer: {
                                type: 'custom',
                                tokenizer: 'standard',
                                filter: ['lowercase', 'synonym_filter'],
                            },
                            synonym_search_analyzer: {
                                type: 'custom',
                                tokenizer: 'standard',
                                filter: ['lowercase', 'synonym_filter'],
                            },
                            default_analyzer: {
                                type: 'standard',
                            },
                        },
                    },
                },
            },
        });

        await this.client.indices.open({ index });
        await this.ensureBaseMapping(index);

        this.synonyms = synonyms;

        return { ok: true };
    }

    async searchDocuments({ index, from = 0, size = 10, sort, ...data }: SearchDocument & { from?: number; size?: number, sort?: string }) {
        const mustData = Object.entries(data).filter(([key]) => key[0] !== '_')
        const mustConditions: any = mustData && mustData.map(([key, value]) => (Array.isArray(value) ? 
            {
                terms: {
                    [key]: value,
                },
            } :
            {
                match: {
                    [key]: {
                        query: value,
                    },
                },
            }
        ));

        const shouldData = Object.entries(data).filter(([key]) => key[0] === '_').map((m) => [m[0].replace(/^_/, ''), m[1]]);
        const shouldConditions: any = shouldData && shouldData.map(([key, value]) => ([
            {
                match: {
                    [key]: {
                        query: value,
                        fuzziness: 'AUTO',
                    },
                },
            },
            {
                match: {
                    text_synonyms: {
                        query: value,
                    },
                },
            },
            {
                wildcard: {
                    [key]: `*${value}*`,
                },
            },
        ]));

        const highlightFields: any = shouldData && shouldData.reduce((acc, [key]) => ({ ...acc, [key]: {} }), {});

        const sortConditions: any = sort ? (await Promise.all(sort.split(',').map(async (s) => {
            const isDesc = s.startsWith('-');
            const field = s.replace(/^-/, '');
            const resolved = await this.resolveSortField(index, field);
            if (!resolved) return null;
            return {
                [resolved.field]: {
                    order: isDesc ? 'desc' : 'asc',
                    ...(resolved.unmappedType && { unmapped_type: resolved.unmappedType }),
                },
            };
        }))).filter(Boolean) : [];

        const response = await this.client.search({
            index,
            body: {
                from,
                size,
                query: {
                    bool: {
                        ...(mustConditions && { must: mustConditions }),
                        ...(shouldConditions && { should: shouldConditions.flat() }),
                        minimum_should_match: shouldConditions?.length ? 1 : 0,
                    },
                },
                ...(sortConditions.length && { sort: sortConditions }),
                highlight: {
                    fields: {
                        text_synonyms: {},
                        ...highlightFields,
                    },
                    pre_tags: ["**"],
                    post_tags: ["**"],
                },
            },
        });

        return response.hits.hits;
    }
};

export type SearchServiceOptions = {
    node: string;
    username?: string;
    password?: string;
    apiKey?: string;
    bearer?: string;
    rejectUnauthorized?: boolean;
    compression?: string;
};

export type BaseDocument = {
    index: string;
    id: string;
};

export type DocumentContent = {
    text: string | string[];
};

export type Document = BaseDocument & DocumentContent;

export type SearchDocument = DocumentContent & {
    index: string;
    text: string;
};

export type updateSynonyms = {
    index: string;
    synonyms: string[];
};

export default SearchService;

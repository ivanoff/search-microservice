import { Client as ElasticClient, HttpConnection } from '@elastic/elasticsearch';

class SearchService {
    private client: ElasticClient;
    private node: string;
    private username?: string;
    private password?: string;
    private apiKey?: string;
    private bearer?: string;
    private rejectUnauthorized?: boolean;
    private compression?: string;
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
        console.log({ res });

        res.forEach((index: any) => {
            if (index.index) this.indexes[index.index] = true;
        });
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
                    properties: {
                        text: {
                            type: 'text',
                            analyzer: 'default_analyzer',
                            search_analyzer: 'synonym_search_analyzer',
                        },
                    },
                },
            },
        });

        this.indexes[index] = true;

        return true;
    }

    async saveDocument({ index, id, ...data }: Document) {
        console.log('Indexes', this.indexes);
        console.log('Data', { index, id, ...data });
        
        if (!this.indexes[index]) await this.createNewIndexWithSynonyms(index);

        const response = await this.client.index({
            index,
            id,
            body: {
                // text_synonyms: text,
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
                            { match: { _id: id } }
                        ]
                    }
                }
            }
        });

        return response;
    }

    async updateSynonyms({ index, synonyms }: updateSynonyms) {
        if (!this.indexes[index]) this.createNewIndexWithSynonyms(index);
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
                            default_analyzer: {
                                type: 'standard',
                            },
                        },
                    },
                },
                mappings: {
                    properties: {
                        text: {
                            type: 'text',
                            analyzer: 'default_analyzer',
                        },
                        text_synonyms: {
                            type: 'text',
                            analyzer: 'synonym_analyzer',
                        },
                    },
                },
            },
        });

        await this.client.indices.open({ index });

        this.synonyms = synonyms;

        return { ok: true };
    }

    async searchDocuments({ index, from = 0, size = 10, ...data }: SearchDocument & { from?: number; size?: number }) {
        const mustData = Object.entries(data).filter(([key]) => key[0] !== '_')
        const mustConditions: any = mustData && mustData.map(([key, value]) => ({
            match: {
                [key]: {
                    query: value,
                },
            },
        }));

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

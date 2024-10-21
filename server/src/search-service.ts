import { Client as ElasticClient, HttpConnection } from '@elastic/elasticsearch';

class SearchService {
    private client: ElasticClient;
    private indexes: Record<string, boolean> = {};
    public synonyms: string[] = [];
    public node: string;

    constructor(node: string = 'http://localhost:9200') {
        this.node = node;
    }

    public async init() {
        while (true) {
            try {
                this.client = new ElasticClient({
                    node: this.node,
                    Connection: HttpConnection,
                });
                await this.client.ping();
                console.log('Connection with ElasticSearch established');
                break;
            } catch (error) {
                console.log('Connection with ElasticSearch failed, retrying in 5 seconds...');
                await Bun.sleep(5000);
            }
        }

        const res = await this.client.cat.indices({ format: 'json' });
        res.forEach((index: any) => {
            if (index.index) this.indexes[index.index] = true;
        });
    }

    async createNewIndexWithSynonyms(index: string) {
console.log(11111);

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

    async saveDocument({ index, id, text }: Document) {
        if (!this.indexes[index]) await this.createNewIndexWithSynonyms(index);

        const response = await this.client.index({
            index,
            id,
            body: {
                text,
                text_synonyms: text
            }
        });

        return response;
    }

    async updateDocument({ index, id, text }: Document) {
        const response = await this.client.update({
            index,
            id,
            body: {
                doc: {
                    text,
                    text_synonyms: text
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
console.log(22222);
        await this.client.indices.close({ index });
console.log(33333, synonyms);

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

    async searchDocuments({ index, text, from = 0, size = 10 }: SearchDocument & { from?: number; size?: number }) {
        const response = await this.client.search({
            index,
            body: {
                from,
                size,
                query: {
                    bool: {
                        should: [
                            {
                                match: {
                                    text: {
                                        query: text,
                                        fuzziness: 'AUTO',
                                    },
                                },
                            },
                            {
                                match: {
                                    text_synonyms: {
                                        query: text,
                                    },
                                },
                            },
                        ],
                    },
                },
                highlight: {
                    fields: {
                        text: {},
                        text_synonyms: {},
                    },
                    pre_tags: ["**"],
                    post_tags: ["**"],
                },
            },
        });

        return response.hits.hits;
    }
}

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

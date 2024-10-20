declare class SearchClient {
    private readonly url;
    constructor(url: string);
    updateSynonyms(synonyms: string[]): Promise<any>;
    getSynonyms(): Promise<any>;
    saveDocument(index: string, id: string, text: string): Promise<any>;
    updateDocument(index: string, id: string, text: string): Promise<any>;
    deleteDocument(index: string, id: string): Promise<any>;
    searchDocuments(index: string, search: string, page?: number, size?: number): Promise<any>;
}
export default SearchClient;
//# sourceMappingURL=client.d.ts.map
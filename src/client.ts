class SearchClient {
  private readonly url: string;

  constructor(
    url: string,
  ) {
    this.url = url;
  }

  async updateSynonyms(synonyms: string[]) {
    const res = await fetch(`${this.url}/`, {
      method: 'POST',
      body: JSON.stringify(synonyms),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.json();
  };

  async getSynonyms() {
    const res = await fetch(`${this.url}`);
    return res.json();
  }

  async saveDocument(index: string, id: string, text: string) {
    const res = await fetch(`${this.url}/${index}`, {
      method: 'POST',
      body: JSON.stringify({ id, text }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.json();
  }

  async updateDocument(index: string, id: string, text: string) {
    const res = await fetch(`${this.url}/${index}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.json();
  }

  async deleteDocument(index: string, id: string) {
    const res = await fetch(`${this.url}/${index}/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.json();
  }

  async searchDocuments(index: string, search: string, page: number = 1, size: number = 10) {
    const res = await fetch(`${this.url}/${index}?search=${encodeURIComponent(search)}&page=${page}&size=${size}`);
    return res.json();
  }
}

export default SearchClient;

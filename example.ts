import SearchClient from 'search-microservice';
// import SearchClient from './src/client';

const client = new SearchClient('http://localhost:9200');

// Update synonyms
client.updateSynonyms(['fast', 'quick', 'speedy']).then(response => {
  console.log('Synonyms updated:', response);
});

// Get synonyms
client.getSynonyms().then(response => {
  console.log('Synonyms:', response);
});

// Save a document
client.saveDocument('my-index', '1', 'This is a test document').then(response => {
  console.log('Document saved:', response);
});

// Update a document
client.updateDocument('my-index', '1', 'This is an updated test document').then(response => {
  console.log('Document updated:', response);
});

// Search documents
client.searchDocuments('my-index', 'test', 1, 10).then(response => {
  console.log('Search results:', response);
});

// Delete a document
client.deleteDocument('my-index', '1').then(response => {
  console.log('Document deleted:', response);
});

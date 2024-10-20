// await searchService.updateSynonyms({
//     index: 'news',
//     synonyms: [
//         'Elasticsearch, Elastic, Эластик, rezert',
//         'search, поиск',
//     ]
// });
// await searchService.saveDocument({
//     index: 'news',
//     id: '1',
//     text: 'This is a sample document about Elasticsearch'
// });
// await searchService.updateDocument({
//     index: 'news',
//     id: '1',
//     text: 'This is an updated document about rezert'
// });
// await searchService.saveDocument({
//     index: 'news',
//     id: '4',
//     text: ['This is an document about rezert', 'aaa'],
// });
// await searchService.saveDocument({
//     index: 'news',
//     id: '2',
//     text: 'Elasticsearch - the best!'
// });
// await searchService.saveDocument({
//     index: 'news',
//     id: '3',
//     text: 'Elasticsearch Elasticsearch'
// });
// await searchService.updateSynonyms({ index: 'news', synonyms: ['ElasticSearch, Elastic, rezert'] });
// await new Promise(resolve => setTimeout(resolve, 2000));

// console.log(await searchService.searchDocuments({ index: 'news', text: 'rezert', from: 0, size: 2 }));
// console.log(await searchService.searchDocuments({ index: 'news', text: 'rezert', from: 2, size: 2 }));

// await searchService.updateSynonyms({ index: 'news', synonyms: ['ElasticSearch, Elastic'] });
// console.log(await searchService.searchDocuments({ index: 'news', text: 'rezert' }));
// await searchService.deleteDocument({ index: 'news', id: '1' });

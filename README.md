batch-runner
====

[![Build Status](https://travis-ci.org/jinjor/batch-runner.svg)](https://travis-ci.org/jinjor/batch-runner)

A promise utility for batching.

## Usage

```javascript
const batchRunner = require('batch-runner');
const requests = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const toPromise = (req, index) => Promise.resolve(req.toLowerCase());

batchRunner.run(requests, toPromise, {
  interval: 10, // default: 0
  concurrency: 3, // default: 1
  maxRetries: 2, // default: 0
  retryInterval: 100, // default: 0
  shouldRetry: err => true //default: err => true
}).then(results => {
  console.log(results);
}).catch(e => {
  console.log('Error:', e.message);
  console.log('Results:', e.results());
  console.log('Errors:', e.errors());
  console.log('Unprocessed:', e.unprocessedRequests());
  // see `e.items` for more information
});
```

## LICENSE

MIT

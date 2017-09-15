batch-runner
====

[![Build Status](https://travis-ci.org/jinjor/batch-runner.svg)](https://travis-ci.org/jinjor/batch-runner)

A promise utility for batching.

## run(requests, toPromise, options)

```javascript
const batchRunner = require('batch-runner');
const requests = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const toPromise = (req, i) => Promise.resolve(req.toLowerCase());

batchRunner.run(requests, toPromise, {
  interval: 10,
  parallel: 3,
  retry: {
    count: 2,
    interval: 100
  }
}).then(results => {
  console.log(results);
}).catch(e => {
  console.log('Error:', e.message);
  console.log('Errors:', e.errors);
  console.log('Unprocessed:', e.unprocessedRequests);
});
```

## LICENSE

MIT

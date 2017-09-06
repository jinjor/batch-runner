promise-util
====

A promise utility for personal use.

## batch(requests, toPromise, options)

```javascript
const requests = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const toPromise = (req, i) => Promise.resolve(req.toLowerCase());

promiseUtil.batch(requests, toPromise, {
  interval: 10,
  retry: {
    count: 2,
    interval: 100
  }
}).then(results => {
  console.log(results);
}).catch(e => {
  console.error('Error:', e.message);
  console.error('Errors:', e.errors);
  console.error('Unprocessed:', e.unprocessedRequests);
});
```

## parallel(requests, toPromise, options)

```javascript
const requests = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const toPromise = (req, i) => Promise.resolve(req.toLowerCase());

promiseUtil.parallel(requests, toPromise, {
  limit: 3
}).then(results => {
  console.log(results);
}).catch(e => {
  console.error('Error:', e.message);
  console.error('Errors:', e.errors);
  console.error('Unprocessed:', e.unprocessedRequests);
});
```

## npm install

[Alpha versions](https://github.com/jinjor/promise-util/tags) are available via GitHub.

```json
{
  "dependencies": {
    "promise-util": "git@github.com:jinjor/promise-util.git#0.x.x"
  }
}
```

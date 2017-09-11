const promiseUtil = require('../src/index.js');
const chai = require('chai');
const assert = chai.assert;

let i = 0;

function getSomething(req) {
  return new Promise((resolve, reject) => {
    setTimeout(function() {
      i++;
      if (i % 5 === 3 || i % 5 === 4) {
        return reject(new Error('cannot get something'));
      } else {
        return resolve(i);
      }
    }, getRandomArbitary(40, 100));
  }).then(i => {
    console.log(req, ' => ', i);
    return i;
  }).catch(e => {
    console.log(req, ' => ', e.message);
    return Promise.reject(e);
  });
}

function getRandomArbitary(min, max) {
  return Math.random() * (max - min) + min;
}

const requests = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const toPromise = (req, i) => getSomething(req);

describe('promise-util', function() {
  describe('#batch()', function() {
    it('should work in minimal', function() {
      return promiseUtil.batch([], () => Promise.resolve());
    });
    it('should return correct results', function() {
      return promiseUtil.batch([5, 6, 7], (req, index) => Promise.resolve([req, index])).then(res => {
        assert.deepEqual(res, [
          [5, 0],
          [6, 1],
          [7, 2]
        ]);
      });
    });
    it('should allow toPromise which does not return Promise type', function() {
      return promiseUtil.batch([5, 6, 7], (req, index) => index).then(res => {
        assert.deepEqual(res, [0, 1, 2]);
      });
    });
    it('should handle falsy requests', function() {
      return promiseUtil.batch([0, false, null], req => Promise.resolve(req)).then(res => {
        assert.deepEqual(res, [0, false, null])
      });
    });
    it('should return correct error', function() {
      return promiseUtil.batch([5, 6, 7], req => (req === 6) ? Promise.reject(0) : 1).then(_ => {
        return Promise.reject('unexpectedly succeeded');
      }).catch(e => {
        if (e === 'unexpectedly succeeded') {
          assert.fail(e);
        }
        assert.deepEqual(e.errors, [0]);
        assert.deepEqual(e.unprocessedRequests, [6, 7]);
      });
    });
    it('should work', function() {
      return promiseUtil.batch(requests, toPromise, {
        interval: 10,
        retry: {
          count: 2,
          interval: 100
        }
      }).then(results => {
        console.log(results);
      }).catch(e => {
        console.error('Error:', e.message);
        console.error('Unprocessed:', e.unprocessedRequests);
      });
    });
    it('should not cause stack-overflow', function() {
      this.timeout(1000 * 30);
      return promiseUtil.batch(new Array(100000).fill(), () => Promise.resolve());
    });
  });
  describe('#parallel()', function() {
    it('should handle empty requests', function() {
      return promiseUtil.parallel([], () => Promise.resolve());
    });
    it('should return correct results', function() {
      return promiseUtil.parallel([5, 6, 7], (req, index) => Promise.resolve([req, index])).then(res => {
        assert.deepEqual(res, [
          [5, 0],
          [6, 1],
          [7, 2]
        ]);
      });
    });
    it('should allow toPromise which does not return Promise type', function() {
      return promiseUtil.parallel([5, 6, 7], (req, index) => index).then(res => {
        assert.deepEqual(res, [0, 1, 2]);
      });
    });
    it('should return results in order', function() {
      return promiseUtil.parallel(
        [5, 6, 7],
        (req, index) => promiseUtil.delay((5 - index) * 100).then(_ => [req, index])
      ).then(res => {
        assert.deepEqual(res, [
          [5, 0],
          [6, 1],
          [7, 2]
        ]);
      });
    });
    it('should work in parallel', function() {
      const log = [];
      return promiseUtil.parallel(
        [5, 6, 7],
        (req, index) => {
          log.push(req);
          return promiseUtil.delay(100).then(_ => {
            log.push(index);
          });
        }
      ).then(res => {
        assert.deepEqual(log, [5, 6, 7, 0, 1, 2]);
      });
    });
    it('should limit concurrency', function() {
      const log = [];
      return promiseUtil.parallel(
        [5, 6, 7],
        (req, index) => {
          log.push(req);
          return promiseUtil.delay(index * 20 + 20).then(_ => {
            log.push(index);
          });
        }, {
          limit: 1
        }
      ).then(res => {
        assert.deepEqual(log, [5, 0, 6, 1, 7, 2]);
      });
    });
    it('should limit concurrency 2', function() {
      const log = [];
      return promiseUtil.parallel(
        [5, 6, 7],
        (req, index) => {
          log.push(req);
          return promiseUtil.delay(index * 20 + 20).then(_ => {
            log.push(index);
          });
        }, {
          limit: 2
        }
      ).then(res => {
        assert.deepEqual(log, [5, 6, 0, 7, 1, 2]);
      });
    });
    it('should limit concurrency 3', function() {
      const log = [];
      return promiseUtil.parallel(
        [5, 6, 7],
        (req, index) => {
          log.push(req);
          return promiseUtil.delay(index * 20 + 20).then(_ => {
            log.push(index);
          });
        }, {
          limit: 3
        }
      ).then(res => {
        assert.deepEqual(log, [5, 6, 7, 0, 1, 2]);
      });
    });
    it('should handle falsy requests', function() {
      return promiseUtil.parallel([0, false, null], req => Promise.resolve(req)).then(res => {
        assert.deepEqual(res, [0, false, null])
      });
    });
    it('should return correct error', function() {
      return promiseUtil.parallel([5, 6, 7], req => (req === 6) ? Promise.reject(0) : req, {
        limit: 1
      }).then(_ => {
        return Promise.reject('unexpectedly succeeded');
      }).catch(e => {
        if (e === 'unexpectedly succeeded') {
          assert.fail(e);
        }
        // assert.deepEqual(e.errors, [0]);
        assert.deepEqual(e.unprocessedRequests, [6, 7]);
      });
    });
    it('should return correct error 2', function() {
      return promiseUtil.parallel([5, 6, 7], req => (req === 6) ? promiseUtil.delay(100).then(_ => Promise.reject(0)) : req, {
        limit: 3
      }).then(_ => {
        return Promise.reject('unexpectedly succeeded');
      }).catch(e => {
        if (e === 'unexpectedly succeeded') {
          assert.fail(e);
        }
        // assert.deepEqual(e.errors, [0]);
        assert.deepEqual(e.unprocessedRequests, [6]);
      });
    });
    it('should retry', function() {
      let calledCount = 0;
      return promiseUtil.parallel([1], (req, i) => {
        calledCount++;
        return (calledCount >= 10) ? Promise.resolve(1) : Promise.reject();
      }, {
        retry: 10
      }).then(res => {
        assert.deepEqual(res, [1]);
      });
    });
    it('should work', function() {
      this.timeout(1000 * 10);
      return promiseUtil.parallel(requests, toPromise, {
        limit: 1,
        retry: 0
      }).then(results => {
        console.log(results);
      }).catch(e => {
        console.error('Error:', e.message);
        console.error('Errors:', e.errors.map(e => e.message));
        console.error('Unprocessed:', e.unprocessedRequests);
      });
    });
    it('should work faster than batch if limit > 1', function() {
      this.timeout(1000 * 5);
      const start = Date.now();
      return promiseUtil.batch(new Array(100).fill(), () => {
        return promiseUtil.delay(10).then(_ => Promise.resolve());
        // return Promise.resolve();
      }).then(_ => {
        const end1 = Date.now();
        return promiseUtil.parallel(new Array(100).fill(), () => {
          return promiseUtil.delay(10).then(_ => Promise.resolve());
          // return Promise.resolve();
        }, {
          limit: 2
        }).then(_ => {
          const end2 = Date.now();
          console.log(end1 - start, end2 - end1);
          assert.isOk(end1 - start > end2 - end1)
        });
      });
    });
    it('should not cause stack-overflow', function() {
      this.timeout(1000 * 30);
      return promiseUtil.parallel(new Array(100000).fill(), () => Promise.resolve(), {
        limit: 1
      });
    });
  });
});

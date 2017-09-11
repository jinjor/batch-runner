const promiseUtil = require('../src/index.js');
const chai = require('chai');
const assert = chai.assert;

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
    it('should retry', function() {
      let calledCount = 0;
      return promiseUtil.batch([1], (req, i) => {
        calledCount++;
        return (calledCount >= 10) ? 1 : Promise.reject();
      }, {
        retry: {
          count: 10
        }
      }).then(res => {
        assert.deepEqual(res, [1]);
      });
    });
    it('should retry only if shouldRetry() returns true', function() {
      let calledCount = 0;
      return promiseUtil.batch([1], (req, i) => {
        calledCount++;
        return (calledCount >= 2) ? 1 : Promise.reject();
      }, {
        retry: {
          count: 10,
          shouldRetry: _ => false
        }
      }).then(res => {
        return Promise.reject('unexpectedly succeeded');
      }).catch(e => {
        if (e === 'unexpectedly succeeded') {
          assert.fail(e);
        }
      });
    });
    it('should not cause stack-overflow', function() {
      this.timeout(1000 * 30);
      return promiseUtil.batch(new Array(100000).fill(), () => Promise.resolve());
    });
  });
  describe('#batch() with { parallel }', function() {
    it('should handle empty requests', function() {
      return promiseUtil.batch([], () => Promise.resolve(), {
        parallel: true
      });
    });
    it('should return correct results', function() {
      return promiseUtil.batch([5, 6, 7], (req, index) => Promise.resolve([req, index]), {
        parallel: true
      }).then(res => {
        assert.deepEqual(res, [
          [5, 0],
          [6, 1],
          [7, 2]
        ]);
      });
    });
    it('should allow toPromise which does not return Promise type', function() {
      return promiseUtil.batch([5, 6, 7], (req, index) => index, {
        parallel: true
      }).then(res => {
        assert.deepEqual(res, [0, 1, 2]);
      });
    });
    it('should return results in order', function() {
      return promiseUtil.batch(
        [5, 6, 7],
        (req, index) => promiseUtil.delay((5 - index) * 100).then(_ => [req, index]), {
          parallel: true
        }
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
      return promiseUtil.batch(
        [5, 6, 7],
        (req, index) => {
          log.push(req);
          return promiseUtil.delay(100).then(_ => {
            log.push(index);
          });
        }, {
          parallel: true
        }
      ).then(res => {
        assert.deepEqual(log, [5, 6, 7, 0, 1, 2]);
      });
    });
    it('should limit concurrency', function() {
      const log = [];
      return promiseUtil.batch(
        [5, 6, 7],
        (req, index) => {
          log.push(req);
          return promiseUtil.delay(index * 20 + 20).then(_ => {
            log.push(index);
          });
        }, {
          parallel: 1
        }
      ).then(res => {
        assert.deepEqual(log, [5, 0, 6, 1, 7, 2]);
      });
    });
    it('should limit concurrency 2', function() {
      const log = [];
      return promiseUtil.batch(
        [5, 6, 7],
        (req, index) => {
          log.push(req);
          return promiseUtil.delay(index * 20 + 20).then(_ => {
            log.push(index);
          });
        }, {
          parallel: 2
        }
      ).then(res => {
        assert.deepEqual(log, [5, 6, 0, 7, 1, 2]);
      });
    });
    it('should limit concurrency 3', function() {
      const log = [];
      return promiseUtil.batch(
        [5, 6, 7],
        (req, index) => {
          log.push(req);
          return promiseUtil.delay(index * 20 + 20).then(_ => {
            log.push(index);
          });
        }, {
          parallel: 3
        }
      ).then(res => {
        assert.deepEqual(log, [5, 6, 7, 0, 1, 2]);
      });
    });
    it('should handle falsy requests', function() {
      return promiseUtil.batch([0, false, null], req => Promise.resolve(req), {
        parallel: true,
      }).then(res => {
        assert.deepEqual(res, [0, false, null])
      });
    });
    it('should return correct error', function() {
      return promiseUtil.batch([5, 6, 7], req => (req === 6) ? Promise.reject(0) : req, {
        parallel: 1,
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
      return promiseUtil.batch([5, 6, 7], req => (req === 6) ? promiseUtil.delay(100).then(_ => Promise.reject(0)) : req, {
        parallel: true
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
      return promiseUtil.batch([1], (req, i) => {
        calledCount++;
        return (calledCount >= 10) ? 1 : Promise.reject();
      }, {
        parallel: true,
        retry: 10
      }).then(res => {
        assert.deepEqual(res, [1]);
      });
    });
    it('should retry only if shouldRetry() returns true', function() {
      let calledCount = 0;
      return promiseUtil.batch([1], (req, i) => {
        calledCount++;
        return (calledCount >= 2) ? 1 : Promise.reject();
      }, {
        parallel: true,
        retry: {
          count: 10,
          shouldRetry: _ => false
        }
      }).then(res => {
        return Promise.reject('unexpectedly succeeded');
      }).catch(e => {
        if (e === 'unexpectedly succeeded') {
          assert.fail(e);
        }
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
        return promiseUtil.batch(new Array(100).fill(), () => {
          return promiseUtil.delay(10).then(_ => Promise.resolve());
          // return Promise.resolve();
        }, {
          parallel: 2
        }).then(_ => {
          const end2 = Date.now();
          console.log(end1 - start, end2 - end1);
          assert.isOk(end1 - start > end2 - end1)
        });
      });
    });
    it('should not cause stack-overflow', function() {
      this.timeout(1000 * 30);
      return promiseUtil.batch(new Array(100000).fill(), () => Promise.resolve());
    });
  });
});

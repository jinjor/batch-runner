const batchRunner = require('../src/index.js');
const chai = require('chai');
const assert = chai.assert;

function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

function flatten(nested) {
  return Array.prototype.concat.apply([], nested);
}

describe('batch-runner', function() {
  describe('#run()', function() {
    function testEcho(request, options, expected) {
      return batchRunner.run(request, (req, index) => req, options).then(res => {
        assert.deepEqual(res, expected);
      });
    }

    function testEchoWithIndex(request, options, expectedFlattenArray) {
      return batchRunner.run(request, (req, index) => [req, index], options).then(res => {
        assert.deepEqual(flatten(res), expectedFlattenArray);
      });
    }
    it('should return correct results (empty)', function() {
      return testEchoWithIndex([], null, []);
    });
    it('should return correct results', function() {
      return testEchoWithIndex([5, 6, 7], null, [5, 0, 6, 1, 7, 2]);
    });
    it('should return correct results (parallel/empty)', function() {
      return testEchoWithIndex([], {
        concurrency: Infinity
      }, []);
    });
    it('should return correct results (parallel)', function() {
      return testEchoWithIndex([5, 6, 7], {
        concurrency: Infinity
      }, [5, 0, 6, 1, 7, 2]);
    });
    it('should handle falsy requests', function() {
      return testEcho([0, false, null, '', undefined, 1 / 0], null, [0, false, null, '', undefined, 1 / 0]);
    });

    function testInterval(requests, from, to) {
      const start = Date.now();
      return batchRunner.run(requests, (req, i) => req, {
        interval: 100
      }).then(res => {
        const end = Date.now();
        assert.isOk(end - start >= from);
        assert.isOk(end - start <= to);
        assert.deepEqual(res, requests);
      });
    }
    it('should take interval', function() {
      return testInterval([], -1, 50);
    });
    it('should take interval 2', function() {
      return testInterval([1], -1, 50);
    });
    it('should take interval 3', function() {
      return testInterval([1, 2, 3, 4], 250, 350);
    });

    function testRetry(count, concurrency) {
      let calledCount = 0;
      let failure = false;
      return batchRunner.run([1], (req, i) => {
        calledCount++;
        return Promise.reject();
      }, {
        concurrency: concurrency,
        retry: {
          count: count
        }
      }).then(_ => {
        failure = true;
      }).catch(_ => {
        assert.equal(calledCount, count + 1);
      }).then(_ => {
        failure && assert.fail('unexpectedly succeeded');
      });
    }
    it('should retry', function() {
      return testRetry(0);
    });
    it('should retry 2', function() {
      return testRetry(9);
    });
    it('should retry(parallel)', function() {
      return testRetry(0, Infinity);
    });
    it('should retry(parallel 2)', function() {
      return testRetry(9, Infinity);
    });
    it('should retry(parallel 3)', function() {
      let calledCount = 0;
      return batchRunner.run([5, 6], (req, i) => {
        calledCount++;
        return (calledCount % 2 === 0) ? [req, i, calledCount] : Promise.reject();
      }, {
        concurrency: Infinity,
        retry: 9
      }).then(res => {
        assert.deepEqual(res, [
          [5, 0, 4],
          [6, 1, 2]
        ]);
      });
    });
    it('should retry(parallel 4)', function() {
      let calledCount = 0;
      return batchRunner.run([5, 6], (req, i) => {
        calledCount++;
        return Promise.resolve(calledCount).then(calledCount => delay(70).then(_ => {
          return (calledCount % 2 === 0) ? [req, i, calledCount] : Promise.reject();
        }));
      }, {
        interval: 20,
        concurrency: Infinity,
        retry: 9
      }).then(res => {
        assert.deepEqual(res, [
          [5, 0, 4],
          [6, 1, 2]
        ]);
      });
    });
    it('should reset retry count on success', function() {
      let calledCount = 0;
      return batchRunner.run([5, 6], (req, i) => {
        calledCount++;
        return (calledCount % 2 === 0) ? [req, i, calledCount] : Promise.reject();
      }, {
        interval: 20,
        retry: 1
      }).then(res => {
        assert.equal(calledCount, 4);
        assert.deepEqual(res, [
          [5, 0, 2],
          [6, 1, 4]
        ]);
      });
    });
    it('should retry once if failed more than once at the same time', function() {
      let calledCount = 0;
      return batchRunner.run([5, 6], (req, i) => {
        calledCount++;
        return Promise.resolve(calledCount).then(calledCount => delay(50).then(_ => {
          return (calledCount > 2) ? [req, i] : Promise.reject();
        }));
      }, {
        interval: 10,
        concurrency: Infinity,
        retry: {
          count: 1,
          interval: 100
        }
      }).then(res => {
        assert.deepEqual(res, [
          [5, 0],
          [6, 1]
        ]);
      });
    });
    it('should retry only if shouldRetry() returns true', function() {
      let calledCount = 0;
      let failure = false;
      return batchRunner.run([1], (req, i) => {
        calledCount++;
        return (calledCount >= 2) ? 1 : Promise.reject();
      }, {
        retry: {
          count: 10,
          shouldRetry: _ => false
        }
      }).then(res => {
        failure = true;
      }).catch(e => {}).then(_ => {
        failure && assert.fail('unexpectedly succeeded');
      });
    });
    it('should retry only if shouldRetry() returns true(parallel)', function() {
      let calledCount = 0;
      let failure = false;
      return batchRunner.run([1], (req, i) => {
        calledCount++;
        return (calledCount >= 2) ? 1 : Promise.reject();
      }, {
        concurrency: Infinity,
        retry: {
          count: 10,
          shouldRetry: _ => false
        }
      }).then(res => {
        failure = true;
      }).catch(e => {}).then(_ => {
        failure && assert.fail('unexpectedly succeeded');
      });
    });

    it('should return results in order', function() {
      return batchRunner.run(
        [5, 6, 7],
        (req, index) => delay((5 - index) * 30).then(_ => [req, index]), {
          concurrency: Infinity
        }
      ).then(res => {
        assert.deepEqual(res, [
          [5, 0],
          [6, 1],
          [7, 2]
        ]);
      });
    });

    function testLimitedConcurrency(concurrency, delayOfIndex, expectation) {
      const log = [];
      return batchRunner.run(
        [5, 6, 7],
        (req, index) => {
          log.push(req);
          return delay(delayOfIndex(index)).then(_ => {
            log.push(index);
          });
        }, {
          concurrency: concurrency
        }
      ).then(res => {
        assert.deepEqual(log, expectation);
      });
    }
    it('should work in parallel', function() {
      return testLimitedConcurrency(1, index => 30, [5, 0, 6, 1, 7, 2]);
    });
    it('should limit concurrency', function() {
      return testLimitedConcurrency(1, index => index * 10 + 10, [5, 0, 6, 1, 7, 2]);
    });
    it('should limit concurrency 2', function() {
      return testLimitedConcurrency(2, index => index * 10 + 10, [5, 6, 0, 7, 1, 2]);
    });
    it('should limit concurrency 3', function() {
      return testLimitedConcurrency(3, index => index * 10 + 10, [5, 6, 7, 0, 1, 2]);
    });

    function testError(toPromise, concurrency, expectedErrors, expectedUnprocessedRequests) {
      return batchRunner.run([5, 6, 7], toPromise, {
        concurrency: concurrency,
      }).then(_ => {
        return Promise.reject('unexpectedly succeeded');
      }).catch(e => {
        if (e === 'unexpectedly succeeded') {
          assert.fail(e);
        }
        assert.deepEqual(e.errors, expectedErrors);
        assert.deepEqual(e.unprocessedRequests, expectedUnprocessedRequests);
      });
    }
    it('should return correct error 1', function() {
      return testError(req => (req === 6) ? Promise.reject(0) : req, 1, [0], [6, 7]);
    });
    it('should return correct error 2', function() {
      return testError(req => (req === 6) ? delay(20).then(_ => Promise.reject(0)) : req, 1, [0], [6, 7]);
    });
    it('should return correct error 3', function() {
      return testError(req => (req === 6) ? delay(20).then(_ => Promise.reject(0)) : req, 2, [0], [6]);
    });
    it('should not cause stack-overflow', function() {
      this.timeout(1000 * 30);
      return batchRunner.run(new Array(100000).fill(), () => Promise.resolve());
    });
    it('should not cause stack-overflow (parallel)', function() {
      this.timeout(1000 * 30);
      return batchRunner.run(new Array(100000).fill(), () => Promise.resolve(), {
        concurrency: Infinity
      });
    });
  });
});

const promiseUtil = require('../src/index.js');
const chai = require('chai');
const assert = chai.assert;

let i = 0;

function getSomething(req) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
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

function doBatch(options) {
  i = 0;
  return promiseUtil.batch(requests, toPromise, options).then(results => {
    console.log(results);
  }).catch(e => {
    console.log('Error:', e.message);
    console.log('Errors:', e.errors.map(e => e.message));
    console.log('Unprocessed:', e.unprocessedRequests);
  });
}

describe('promise-util', function() {
  describe('#batch()', function() {
    it('should work', function() {
      return doBatch({
        interval: 10,
        parallel: 3
      });
    });
    it('should work', function() {
      return doBatch({
        interval: 10,
        parallel: 3,
        retry: {
          count: 2,
          interval: 100
        }
      });
    });
  });
});

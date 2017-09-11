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
  });
  describe('#batch() with { parallel }', function() {
    it('should work', function() {
      this.timeout(1000 * 10);
      return promiseUtil.batch(requests, toPromise, {
        parallel: true,
        retry: 0
      }).then(results => {
        console.log(results);
      }).catch(e => {
        console.error('Error:', e.message);
        console.error('Unprocessed:', e.unprocessedRequests);
      });
    });
  });
});

const promiseUtil = require('../src/index.js');


var i = 0;

function getSomething() {
  return new Promise((resolve, reject) => {
    setTimeout(function() {
      i++;
      if (i % 5 === 3 || i % 5 === 4) {
        return reject(new Error('cannot get something'));
      } else {
        return resolve(i);
      }
    }, 100);
  });
}

const promises = [
  getSomething,
  getSomething,
  getSomething,
  getSomething,
  getSomething,
  getSomething,
  getSomething,
];


promiseUtil.series(promises, {
  interval: 100,
  retry: {
    count: 2,
    interval: 1000
  }
}).then(results => {
  console.log(results);
}).catch(e => {
  console.error('Error:', e.message);
});

const promiseUtil = require('../src/index.js');


var i = 0;

function getSomething(param) {
  return new Promise((resolve, reject) => {
    setTimeout(function() {
      i++;
      if (i % 5 === 3 || i % 5 === 4) {
        return reject(new Error('cannot get something'));
      } else {
        return resolve(i);
      }
    }, 100);
  }).then(i => {
    console.log(param, ' => ', i);
    return i;
  }).catch(e => {
    console.log(param, ' => ', e.message);
    return Promise.reject(e);
  });
}


/* All items must be type of `number => Promise[a]` */
const promises = [
  () => getSomething('A'),
  () => getSomething('B'),
  () => getSomething('C'),
  () => getSomething('D'),
  () => getSomething('E'),
  () => getSomething('F'),
  () => getSomething('G'),
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

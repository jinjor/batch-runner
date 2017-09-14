const promiseUtil = require('../src/index.js');

let i = 0;

function getSomething(req, index) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      i++;
      if (i % 5 === 3 || i % 5 === 5) {
        return reject(i);
      } else {
        return resolve(i);
      }
    }, getRandomArbitary(40, 100));
  });
}

function getRandomArbitary(min, max) {
  return Math.random() * (max - min) + min;
}

const requests = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
let results = [];
const scale = 0.8;

function reset() {
  i = 0;
  results = requests.map(req => {
    return {
      request: req,
      results: []
    };
  });
}

function render(start, results) {
  const list = document.getElementById('list');
  let s = '';
  results.forEach(result => {
    s = renderRequest(s, result);
  });
  list.innerHTML = s;
  const rowElements = document.querySelectorAll('#list .row');
  results.forEach((result, i) => {
    const resultElements = rowElements[i].querySelectorAll('#list .result');
    result.results.forEach((r, j) => {
      if (r.requestStart && r.requestEnd) {
        const resultElement = resultElements[j];
        const time = r.requestEnd - r.requestStart;
        resultElement.style.left = (r.requestStart - start) * scale + 'px';
        resultElement.style.width = (time * scale) + 'px';
      }
    });
  });
}

function renderRequest(s, result) {
  s += `<div class="row">`;
  s += `<div class="header">${result.request}</div>`;
  s += `<div class="body">`;
  result.results.forEach(r => {
    s += `<div class="result ${r.state}">`;
    if (r.requestEnd) {
      s += `<div class="circle" data-request-start="${r.requestStart}"></div>`;
      s += `<div class="bar"></div>`;
      s += `<div class="circle" data-request-end="${r.requestEnd}"></div>`;
    }
    s += `</div>`;
  });
  s += `</div>`;
  const r = result.results[result.results.length - 1];
  if (r) {
    if (r.response) {
      s += `<div class="response">${r.response}</div>`;
    } else if (r.error) {
      s += `<div class="response error">${r.error}</div>`;
    } else if (r.error) {
      s += `<div class="response"></div>`;
    }
  }
  s += `</div>`;
  return s;
}


function execute(options) {

  const start = Date.now();
  render(start, results);

  return promiseUtil.batch(requests, (req, i) => {
    var result = {};
    results[i].results.push(result);
    result.requestStart = Date.now();
    result.state = 'waiting';
    // render(start, results);
    return getSomething(req).then(res => {
      result.response = res;
      result.requestEnd = Date.now();
      result.state = 'success';
      render(start, results);
      return res;
    }).catch(e => {
      result.error = e;
      result.requestEnd = Date.now();
      result.state = 'error';
      render(start, results);
      return Promise.reject(e);
    })
  }, options);
}

button.addEventListener('click', e => {
  e.preventDefault();
  const interval = +document.getElementById('interval').value;
  const parallel = +document.getElementById('parallel').value;
  const retry = +document.getElementById('retry').value;
  const retryInterval = +document.getElementById('retry-interval').value;

  execute({
    interval: interval,
    parallel: parallel,
    retry: {
      count: retry,
      interval: retryInterval
    }
  }).then(results => {
    console.log(results);
  }).catch(e => {
    console.log('Error:', e.message);
    console.log('Errors:', e.errors.map(e => e.message));
    console.log('Unprocessed:', e.unprocessedRequests);
  });
});

reset();
render(Date.now(), results);

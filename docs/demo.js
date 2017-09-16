const batchRunner = require('../src/index.js');
const snabbdom = require('snabbdom');
const h = require('snabbdom/h').default;
const patch = snabbdom.init([
  require('snabbdom/modules/style').default
]);

const container = document.getElementById('container');
let vnode = null;

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
  const newNode = h('div#list', results.map(result => {
    return renderRequest(start, result);
  }));
  patch(vnode || container, newNode);
  vnode = newNode;
}

function renderRequest(start, result) {
  return h('div.row', [
    h('div.header', [result.request]),
    h('div.body', result.results.map(r => {
      if (!r.requestEnd) {
        return h(`div.result.${r.state}`);
      }
      const time = r.requestEnd - r.requestStart;
      const left = (r.requestStart - start) * scale + 'px';
      const width = (time * scale) + 'px';
      return h(`div.result.${r.state}`, {
        style: {
          left: left,
          width: width
        }
      }, [
        h('div.circle'),
        h('div.bar'),
        h('div.circle')
      ]);
    })),
    (() => {
      const r = result.results[result.results.length - 1];
      if (r && r.response) {
        return h('div.response', [r.response]);
      } else if (r && r.error) {
        return h('div.response.error', [r.error]);
      } else {
        return h('div.response');
      }
    })()
  ]);
}

function execute(options) {

  const start = Date.now();
  render(start, results);

  return batchRunner.run(requests, (req, i) => {
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
  const concurrency = +document.getElementById('concurrency').value;
  const retry = +document.getElementById('retry').value;
  const retryInterval = +document.getElementById('retry-interval').value;

  execute({
    interval: interval,
    concurrency: concurrency,
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

const batchRunner = require('../src/index.js');
const snabbdom = require('snabbdom');
const h = require('snabbdom/h').default;
const patch = snabbdom.init([
  require('snabbdom/modules/style').default
]);

const container = document.getElementById('container');
const infoContainer = document.getElementById('info-container');
let vnode = null;
let infoVnode = null;

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
let info = {};
let scale = 0;

function reset() {
  i = 0;
  scale = window.innerWidth / 1200;
  results = requests.map(req => {
    return {
      request: req,
      results: []
    };
  });
  info = {};
}

function render(start, results, info) {
  const newNode = renderList(start, results);
  patch(vnode || container, newNode);
  vnode = newNode;

  const newInfoNode = renderInfo(info);
  patch(infoVnode || infoContainer, newInfoNode);
  infoVnode = newInfoNode;
}

function renderInfo(info) {
  const items = [{
    key: 'Results',
    value: (info.results || []).join(', ')
  }, {
    key: 'Errors',
    value: (info.errors || []).join(', ')
  }, {
    key: 'Unprocessed Requests',
    value: (info.unprocessedRequests || []).join(', ')
  }];
  return h('div#info', items.map(item => {
    return renderEachInfo(item);
  }));
}

function renderEachInfo(item) {
  return h('div', [item.key, ': ', item.value]);
}

function renderList(start, results) {
  return h('div#list', results.map(result => {
    return renderRequest(start, result);
  }));
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
  reset();
  const start = Date.now();
  render(start, results, info);

  return batchRunner.run(requests, (req, i) => {
    var result = {};
    results[i].results.push(result);
    result.requestStart = Date.now();
    result.state = 'waiting';
    // render(start, results, info);
    return getSomething(req).then(res => {
      result.response = res;
      result.requestEnd = Date.now();
      result.state = 'success';
      render(start, results, info);
      return res;
    }).catch(e => {
      result.error = e;
      result.requestEnd = Date.now();
      result.state = 'error';
      render(start, results, info);
      return Promise.reject(e);
    });
  }, options).then(results => {
    info.results = results;
  }).catch(e => {
    info.results = e.results();
    info.errors = e.errors();
    info.unprocessedRequests = e.unprocessedRequests();
  }).then(_ => {
    render(start, results, info);
  });
}

button.addEventListener('click', e => {
  e.preventDefault();
  const interval = +document.getElementById('interval').value;
  const concurrency = +document.getElementById('concurrency').value;
  const maxRetries = +document.getElementById('max-retries').value;
  const retryInterval = +document.getElementById('retry-interval').value;

  execute({
    interval: interval,
    concurrency: concurrency,
    maxRetries: maxRetries,
    retryInterval: retryInterval
  });
});

reset();
render(Date.now(), results, info);

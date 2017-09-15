/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

const batchRunner = __webpack_require__(1);

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


/***/ }),
/* 1 */
/***/ (function(module, exports) {

function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

function run(requests, toPromise, options) {
  options = options || {};
  const interval = options.interval || 0;
  const retryCount = (options.retry && typeof options.retry.count === 'number') ? options.retry.count : options.retry || 0;
  const retryInterval = (options.retry && typeof options.retry.interval === 'number') ? options.retry.interval : 0;
  const limit = (options.parallel === true) ?
    null :
    (typeof options.parallel === 'number') ?
    options.parallel :
    1;
  const shouldRetry = (options.retry && typeof options.retry.shouldRetry === 'function') ? options.retry.shouldRetry : (e => true);
  const reqInfoList = requests.map((req, i) => {
    return {
      index: i,
      request: req,
      ok: false,
      result: undefined,
      errors: [],
    };
  });
  const loop = makeLoopFunction(reqInfoList, toPromise, interval, retryCount, retryInterval, limit, shouldRetry);
  return new Promise(loop).then(_ => makeResults(reqInfoList));
}

function makeLoopFunction(reqInfoList, toPromise, interval, retryCount, retryInterval, limit, shouldRetry) {
  const stack = reqInfoList.concat();
  let count = 0;
  let stopRequest = false;
  let retriedCount = 0;
  let lastRequestTime = null;

  const loop = (resolve, reject) => {
    try {
      while (true) {
        if (stopRequest || (limit && count >= limit) || stack.length === 0) {
          break;
        }
        const reqInfo = stack.shift();
        count++;
        const requestTime = Date.now();
        const waitTime = lastRequestTime ? Math.max(0, lastRequestTime + interval - requestTime) : 0;

        lastRequestTime = requestTime + waitTime;
        const wait = waitTime ? delay(waitTime) : Promise.resolve();
        wait.then(_ => toPromise(reqInfo.request, reqInfo.index)).then(result => {
          reqInfo.result = result;
          reqInfo.ok = true;
          reqInfo.errors.length = 0;
          retriedCount = 0;
        }).catch(e => {
          reqInfo.errors.push(e);
          if (shouldRetry(e)) {
            stack.unshift(reqInfo);
          }
          stopRequest = true;
        }).then(_ => {
          count--;
          loop(resolve, reject);
        });

      }
      if (stopRequest && count === 0) {
        if (stack.length > 0 && retriedCount < retryCount) {
          const wait = (typeof retryInterval === 'number') ? delay(retryInterval) : Promise.resolve();
          wait.then(_ => {
            stopRequest = false;
            retriedCount++;
            loop(resolve, reject);
          });
        } else {
          resolve();
        }
      } else if (stack.length === 0 && count === 0) {
        resolve();
      }
    } catch (e) {
      reject(e);
    };
  }
  return loop;
}

function makeResults(reqInfoList) {
  const results = [];
  const errors = [];
  const unprocessed = [];
  for (let i = 0; i < reqInfoList.length; i++) {
    const reqInfo = reqInfoList[i];
    if (reqInfo.errors.length > 0) {
      errors.push(reqInfo.errors[reqInfo.errors.length - 1]);
    } else {
      results.push(reqInfo.result);
    }
    if (!reqInfo.ok) {
      unprocessed.push(reqInfo.request);
    }
  }
  if (errors.length) {
    const err = new Error('Some requests are unprocessed.');
    err.errors = errors;
    err.unprocessedRequests = unprocessed;
    return Promise.reject(err);
  }
  return results;
}

module.exports = {
  delay: delay,
  run: run,
};


/***/ })
/******/ ]);
function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

function repeat(length, value) {
  const arr = new Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = value;
  }
  return arr;
}

function parallel(requests, toPromise, options) {
  const init = new Array(requests.length);
  const reducer = (results, result, index) => {
    results[index] = result;
    return results;
  }
  return doParallel(requests, toPromise, reducer, init, options);
}

function doParallel(requests, toPromise, reducer, init, options) {
  options = options || {};
  const failures = new Array(requests.length);
  const limit = options.limit || null;
  const stopImmediately = options.stopImmediately || false;
  let results = init;
  let index = 0;
  let count = 0;
  let stop = false;
  return new Promise((resolve, reject) => {
    function send() {
      if (stop) {
        return;
      }
      if (limit && count >= limit) {
        return;
      }
      if (index >= requests.length) {
        if (count === 0) {
          response(resolve, reject, requests, results, failures);
        }
        return;
      }
      Promise.resolve(index).then(index => {
        send();
        toPromise(requests[index], index).then(result => {
          results = reducer(results, result, index);
          failures[index] = null; // successful flag
        }).catch(e => {
          failures[index] = e;
          if (stopImmediately) {
            stop = true;
          }
        }).then(_ => {
          count--;
          if (count === 0) {
            response(resolve, reject, requests, results, failures);
          } else {
            send();
          }
        });
      });
      index++;
      count++;
    }
    send();
  });
}

function parallel2(requests, toPromise, options) {
  options = options || {};
  const retryCount = options.retry || 0;
  const limit = options.limit || null;
  const stopImmediately = options.stopImmediately || false;
  const reqInfoList = requests.map((req, i) => {
    return {
      index: i,
      request: req,
      result: undefined,
      errors: [],
    };
  });
  const stack = reqInfoList.concat(); //copy
  let count = 0;
  let stopRequest = false;
  return new Promise((resolve, _) => {
    function loop() {
      // (count % 100 === 0) && console.log(count);
      if (stopRequest) {
        return;
      }
      if (limit && count >= limit) {
        return;
      }
      const reqInfo = stack.shift();
      if (typeof reqInfo === 'undefined') {
        if (count === 0) {
          resolve();
        }
        return;
      }
      Promise.resolve().then(_ => {
        loop();
        toPromise(reqInfo.request, reqInfo.index).then(result => {
          reqInfo.result = result;
          reqInfo.errors.length = 0;
        }).catch(e => {
          reqInfo.errors.push(e);
          if (reqInfo.errors.length <= retryCount) {
            // console.log('retrying...');
            stack.unshift(reqInfo);
          } else {
            if (stopImmediately) {
              stopRequest = true;
            }
          }
        }).then(_ => {
          count--;
          if (count === 0) {
            resolve();
          } else {
            loop();
          }
        });
      });
      count++;
    }
    loop();
  }).then(_ => {
    const results = [];
    const errors = [];
    const unprocessed = [];
    for (let i = 0; i < requests.length; i++) {
      const reqInfo = reqInfoList[i];
      if (reqInfo.errors.length > 0) {
        const err = new Error(`Tried ${reqInfo.errors.length} times but could not get successful result.`);
        err.errors = reqInfo.errors;
        errors.push(err);
        unprocessed.push(reqInfo.request);
      } else {
        results.push(reqInfo.result);
      }
    }
    if (errors.length) {
      const err = new Error('Some requests are unprocessed.');
      err.errors = errors;
      err.unprocessedRequests = unprocessed;
      return Promise.reject(err);
    }
    return results;
  });
}


function response(resolve, reject, requests, results, failures) {
  const errors = [];
  const unprocessed = [];
  for (let i = 0; i < requests.length; i++) {
    const failure = failures[i];
    if (typeof failure !== 'undefined' && failure !== null) {
      errors.push(failure);
    }
    if (failure !== null) {
      unprocessed.push(requests[i]);
    }
  }
  if (unprocessed.length > 0) {
    const err = new Error('Some requests are unprocessed.');
    err.errors = errors;
    err.unprocessedRequests = unprocessed;
    reject(err);
  } else {
    resolve(results);
  }
}

function batch(requests, toPromise, options) {
  return reduce(requests, toPromise, (results, result, i) => {
    results.push(result);
    return results;
  }, [], options);
}

function reduce(requests, toPromise, reducer, init, options) {
  options = options || {};
  const interval = options.interval || 0;
  const retryIntervals = createRetryIntervals(options.retry, options.interval);
  return requests.reduce((memo, request, i) => {
    return memo.then(results => {
      const wait = (i && interval) ? delay(interval) : Promise.resolve();
      const createPromise = () => toPromise(request, i).then(result => reducer(results, result, i));
      return wait.then(results => {
        return doWithRetry(createPromise, retryIntervals, 0, []).catch(err => {
          err.unprocessedRequests = requests.slice(i);
          return Promise.reject(err);
        });
      });
    });
  }, Promise.resolve(init));
}

function createRetryIntervals(retry, interval) {
  if (!retry) {
    return [];
  }
  if (retry.length) {
    return retry;
  }
  const retryCount = (typeof retry === 'number') ? retry : retry.count || 0;
  const retryInterval = retry.interval || interval || 0;
  return repeat(retryCount, retryInterval);
}

function doWithRetry(createPromise, retryIntervals, retryindex, errors) {
  return createPromise().catch(e => {
    errors.push(e);
    const retryInterval = retryIntervals[retryindex];
    if (typeof retryInterval === 'number') {
      return delay(retryInterval).then(_ => {
        return doWithRetry(createPromise, retryIntervals, retryindex + 1, errors);
      });
    }
    return Promise.reject(reduceErrors(errors));
  });
}

function reduceErrors(errors) {
  const errorMessage = errors.filter(e => !!e).map(formatErrorMessage).join('\t');
  const e = new Error(errorMessage);
  e.errors = errors;
  return e;
}

function formatErrorMessage(e, i) {
  return '[' + (i + 1) + '] ' + (e.message || e.toString());
}


module.exports = {
  delay: delay,
  batch: batch,
  parallel: parallel2
};

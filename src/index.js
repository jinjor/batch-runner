function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

function parallel(requests, toPromise, options) {
  options = options || {};
  const interval = 0;
  const retryCount = (options.retry && typeof options.retry.count === 'number') ? options.retry.count : options.retry || 0;
  const retryInterval = (options.retry && typeof options.retry.interval === 'number') ? options.retry.interval : 0;
  const limit = options.limit || null;
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
  const stack = reqInfoList.concat();
  let count = 0;
  let stopRequest = false;
  let retriedCount = 0;
  let lastRequestTime = null;

  function loop(resolve) {
    while (true) {
      if (stopRequest || (limit && count >= limit) || stack.length === 0) {
        break;
      }
      const reqInfo = stack.shift();
      count++;
      const requestTime = Date.now();
      const waitTime = lastRequestTime ? Math.max(0, lastRequestTime + interval - requestTime) : 0;
      const wait = waitTime ? delay(waitTime) : Promise.resolve();
      wait.then(_ => toPromise(reqInfo.request, reqInfo.index)).then(result => {
        reqInfo.result = result;
        reqInfo.ok = true;
        reqInfo.errors.length = 0;
      }).catch(e => {
        reqInfo.errors.push(e);
        if (shouldRetry(e)) {
          stack.unshift(reqInfo);
        }
        stopRequest = true;
      }).then(_ => {
        count--;
        loop(resolve);
      });
      lastRequestTime = requestTime;
    }
    if (stopRequest && count === 0) {
      if (stack.length > 0 && retriedCount < retryCount) {
        const wait = (typeof retryInterval === 'number') ? delay(retryInterval) : Promise.resolve();
        wait.then(_ => {
          stopRequest = false;
          retriedCount++;
          loop(resolve);
        });
      } else {
        resolve();
      }
    } else if (stack.length === 0 && count === 0) {
      resolve();
    }
  }
  return new Promise(loop).then(_ => {
    const results = [];
    const errors = [];
    const unprocessed = [];
    for (let i = 0; i < reqInfoList.length; i++) {
      const reqInfo = reqInfoList[i];
      if (reqInfo.errors.length > 0) {
        const err = new Error(`Tried ${reqInfo.errors.length} times but could not get successful result. ` + formatErrorMessages(reqInfo.errors));
        err.errors = reqInfo.errors;
        errors.push(err);
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
  });
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
  const shouldRetry = (options.retry && typeof options.retry.shouldRetry === 'function') ? options.retry.shouldRetry : (e => true);
  return requests.reduce((memo, request, i) => {
    return memo.then(results => {
      const wait = (i && interval) ? delay(interval) : Promise.resolve();
      const createPromise = () => Promise.resolve().then(_ => toPromise(request, i)).then(result => reducer(results, result, i));
      return wait.then(results => {
        return doWithRetry(createPromise, shouldRetry, retryIntervals, 0, []).catch(err => {
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
  return new Array(retryCount).fill(retryInterval);
}

function doWithRetry(createPromise, shouldRetry, retryIntervals, retryIndex, errors) {
  return createPromise().catch(e => {
    errors.push(e);
    const retryInterval = retryIntervals[retryIndex];
    if (shouldRetry(e) && typeof retryInterval === 'number') {
      return delay(retryInterval).then(_ => {
        return doWithRetry(createPromise, shouldRetry, retryIntervals, retryIndex + 1, errors);
      });
    }
    return Promise.reject(reduceErrors(errors));
  });
}

function reduceErrors(errors) {
  const errorMessage = formatErrorMessages(errors);
  const e = new Error(errorMessage);
  e.errors = errors;
  return e;
}

function formatErrorMessages(errors) {
  return errors.map(formatErrorMessage).join(' ');
}

function formatErrorMessage(e, i) {
  return '[' + (i + 1) + '] ' + (e ? e.message || JSON.stringify(e) : '');
}

module.exports = {
  delay: delay,
  batch: batch,
  parallel: parallel
};

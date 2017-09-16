function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

function run(requests, toPromise, options) {
  options = options || {};
  const interval = options.interval || 0;
  const maxRetries = (options.retry && typeof options.retry.count === 'number') ? options.retry.count : options.retry || 0;
  const retryInterval = (options.retry && typeof options.retry.interval === 'number') ? options.retry.interval : 0;
  const limit = (typeof options.concurrency === 'number') ? Math.max(options.concurrency, 1) : 1;
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
  const timeUntilNextRetry = retriedCount => {
    if (retriedCount < maxRetries) {
      return retryInterval;
    }
    return -1;
  }
  const loop = makeLoopFunction(reqInfoList, toPromise, interval, timeUntilNextRetry, limit, shouldRetry);
  return new Promise(loop).then(_ => makeResults(reqInfoList));
}

function makeLoopFunction(reqInfoList, toPromise, interval, timeUntilNextRetry, limit, shouldRetry) {
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
        if (stack.length > 0) {
          const time = timeUntilNextRetry(retriedCount);
          if (typeof time !== 'number' || time < 0) {
            resolve();
          } else {
            const waitForRetry = (time > 0) ? delay(time) : Promise.resolve();
            waitForRetry.then(_ => {
              stopRequest = false;
              retriedCount++;
              loop(resolve, reject);
            });
          }
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
  run: run
};

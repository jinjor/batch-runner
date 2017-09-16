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
  const toRetryInterval = retriedCount => {
    return retryInterval;
  };
  const timeUntilNextRetry = retriedCount => {
    if (retriedCount < maxRetries) {
      return toRetryInterval(retriedCount);
    }
    return -1;
  };
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
const getResults = reqInfoList => () => {
  return reqInfoList.filter(reqInfo => reqInfo.ok).map(reqInfo => {
    return reqInfo.result;
  });
};
const getErrors = reqInfoList => () => {
  return reqInfoList.filter(reqInfo => reqInfo.errors.length).map(reqInfo => {
    return reqInfo.errors[reqInfo.errors.length - 1];
  });
};
const getUnprocessed = reqInfoList => () => {
  return reqInfoList.filter(reqInfo => !reqInfo.ok).map(reqInfo => {
    return reqInfo.request;
  });
};

function makeResults(reqInfoList) {
  if (getErrors(reqInfoList)().length) {
    const err = new Error('Some requests are unprocessed.');
    err.items = reqInfoList;
    err.results = getResults(reqInfoList);
    err.errors = getErrors(reqInfoList);
    err.unprocessedRequests = getUnprocessed(reqInfoList);
    return Promise.reject(err);
  }
  return getResults(reqInfoList)();
}

module.exports = {
  run: run
};

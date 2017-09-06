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
  const results = new Array(requests.length);
  const failures = new Array(requests.length);
  const limit = options.limit || null;
  const stopImmediately = options.stopImmediately || false;
  let cursor = 0;
  let count = 0;
  let stop = false;
  return new Promise((resolve, reject) => {
    function send() {
      // console.log('count', count);
      if (stop) {
        return;
      }
      if (limit && count >= limit) {
        return;
      }
      const request = requests[cursor];
      if (!request) {
        return;
      }

      Promise.resolve(cursor).then(cursor => {
        return toPromise(request).then(result => {
          results[cursor] = result;
          failures[cursor] = null; // successful flag
        }).catch(e => {
          failures[cursor] = e;
          if (stopImmediately) {
            stop = true;
          }
        }).then(_ => {
          count--;
          if (count === 0) {
            response(resolve, reject, requests, failures);
          } else {
            send();
          }
        });
      });
      cursor++;
      count++;
      send();
    }
    send();
  });
}

function response(resolve, reject, requests, failures) {
  const errors = [];
  const unprocessed = [];
  for (let i = 0; i < requests.length; i++) {
    const failure = failures[i];
    if (failure) {
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
  const interval = options.interval || 0;
  const retryIntervals = createRetryIntervals(options.retry, options.interval);
  return requests.reduce((memo, request, i) => {
    return memo.then(results => {
      const wait = (i && interval) ? delay(interval) : Promise.resolve();
      const createPromise = () => toPromise(request, i).then(result => reducer(results, result, i));
      return wait.then(results => {
        return doWithRetry(createPromise, retryIntervals, 0, []).catch(e => {
          e.unprocessedRequests = requests.slice(i);
          return Promise.reject(e);
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

function doWithRetry(createPromise, retryIntervals, retryCursor, errors) {
  return createPromise().catch(e => {
    errors.push(e);
    const retryInterval = retryIntervals[retryCursor];
    if (typeof retryInterval === 'number') {
      return delay(retryInterval).then(_ => {
        return doWithRetry(createPromise, retryIntervals, retryCursor + 1, errors);
      });
    }
    return Promise.reject(reduceErrors(errors));
  });
}

function reduceErrors(errors) {
  if (errors.length === 1) {
    return errors[0];
  }
  const errorMessage = errors.filter(e => !!e).map(formatErrorMessage).join('\t');
  return new Error(errorMessage);
}

function formatErrorMessage(e, i) {
  return '[' + (i + 1) + '] ' + (e.message || e.toString());
}


module.exports = {
  delay: delay,
  batch: batch,
  parallel: parallel
};

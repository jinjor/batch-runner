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

function series(functions, options) {
  return reduce(functions, (results, result, i) => {
    results.push(result);
    return results;
  }, [], options);
}

function reduce(functions, reducer, init, options) {
  const interval = options.interval || 0;
  const retryIntervals = createRetryIntervals(options.retry, options.interval);
  return functions.reduce((memo, p, i) => {
    return memo.then(results => (i && interval) ? delay(interval).then(_ => results) : results).then(results => {
      return doWithRetry(_ => p(i).then(result => reducer(results, result, i)), retryIntervals, 0, []);
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
  series: series,
  reduce: reduce,
};

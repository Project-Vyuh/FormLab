// Never persist or log raw SDK errors: they may contain request URLs or secrets.
export function providerFailure(error) {
  const status = Number(error.status || error.code || 0);
  const message = String(error.message || '');
  if (status === 429 && /(?:limit["']?\s*[:=]\s*["']?0\b|quotaValue["']?\s*:\s*["']?0\b|quota.*(?:per.day|daily))/i.test(message)) {
    return { code: 'PROVIDER_QUOTA', retryable: false, pause: 300000, message: 'Provider quota is unavailable. Check billing and quota before retrying.' };
  }
  if ([401, 403].includes(status)) return { code: 'PROVIDER_ACCESS', retryable: false, pause: 300000, message: 'Provider access is unavailable. Check server credentials and permissions.' };
  if ([429, 503].includes(status)) return { code: 'PROVIDER_TEMPORARY', retryable: true, pause: 30000, message: 'Provider temporarily unavailable.' };
  if (error.code === 'INVALID_OUTPUT') return { code: error.code, retryable: false, message: 'Provider returned no valid output for this request.' };
  if (error.code === 'CLAIM_LOST') return { code: error.code, retryable: false, message: 'Worker ownership changed; stale output was discarded.' };
  return { code: 'GENERATION_FAILED', retryable: false, message: 'Generation failed; provider or media validation rejected the request.' };
}

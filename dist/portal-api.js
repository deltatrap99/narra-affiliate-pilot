export class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function portalRequest(path, fields) {
  const headers = { Accept: 'application/json' };
  const options = { headers, credentials: 'same-origin', cache: 'no-store' };
  if (fields !== undefined) {
    headers['content-type'] = 'application/json';
    options.method = 'POST';
    options.body = JSON.stringify(fields);
  }
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new RequestError(response.status, data.error || 'Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.');
  return data;
}

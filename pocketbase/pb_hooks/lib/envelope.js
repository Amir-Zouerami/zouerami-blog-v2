// Shared by the HTTP hooks: the same { meta, data, traceId } envelope as the web app.
// (Handlers run in isolated contexts, so this is loaded with require() inside each handler.)

function uuidv7() {
  const ts = Date.now().toString(16).padStart(12, '0');
  const rnd = $security.randomStringWithAlphabet(20, '0123456789abcdef');
  const variant = '89ab'[parseInt(rnd[3], 16) % 4];
  return ts.slice(0, 8) + '-' + ts.slice(8) + '-7' + rnd.slice(0, 3) + '-' + variant + rnd.slice(4, 7) + '-' + rnd.slice(7, 19);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Trace id for this request: the caller's x-trace-id when it is a valid UUID, otherwise a fresh UUIDv7. */
function traceIdOf(e) {
  const inbound = e.request.header.get('X-Trace-Id');
  return inbound && UUID.test(inbound) ? inbound : uuidv7();
}

function respond(e, traceId, status, code, data, message) {
  e.response.header().set('X-Trace-Id', traceId);
  e.response.header().set('Cache-Control', 'no-store');
  return e.json(status, { meta: { status: status, code: code, message: message }, data: data === undefined ? null : data, traceId: traceId });
}

module.exports = { uuidv7: uuidv7, traceIdOf: traceIdOf, respond: respond };

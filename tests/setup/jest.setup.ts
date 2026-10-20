/**
 * Jest setup: expose the WHATWG Fetch API globals (Request/Response/Headers/
 * fetch) to the jsdom test environment, which does not define them. Several
 * modules under test (the admin fetch hook, Next.js route helpers) rely on
 * these globals being present.
 */

const util = require("util");
const streamWeb = require("stream/web");
const workerThreads = require("worker_threads");

// undici depends on these globals; jsdom does not provide them.
if (typeof global.TextEncoder === "undefined") global.TextEncoder = util.TextEncoder;
if (typeof global.TextDecoder === "undefined") global.TextDecoder = util.TextDecoder;
if (typeof global.ReadableStream === "undefined") global.ReadableStream = streamWeb.ReadableStream;
if (typeof global.WritableStream === "undefined") global.WritableStream = streamWeb.WritableStream;
if (typeof global.TransformStream === "undefined") global.TransformStream = streamWeb.TransformStream;
if (typeof global.MessageChannel === "undefined") global.MessageChannel = workerThreads.MessageChannel;
if (typeof global.MessagePort === "undefined") global.MessagePort = workerThreads.MessagePort;

const undici = require("undici");

if (typeof global.Request === "undefined") global.Request = undici.Request as any;
if (typeof global.Response === "undefined") global.Response = undici.Response as any;
if (typeof global.Headers === "undefined") global.Headers = undici.Headers as any;
if (typeof global.FormData === "undefined") global.FormData = undici.FormData as any;
if (typeof global.fetch === "undefined") global.fetch = undici.fetch as any;

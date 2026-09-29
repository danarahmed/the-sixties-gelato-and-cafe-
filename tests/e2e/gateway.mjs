// A stand-in for Supabase's API gateway, for LOCAL end-to-end checks only:
//   /rest/v1/*    -> the real PostgREST (port 54330)
//   /auth/v1/*    -> a minimal auth server issuing HS256 JWTs PostgREST accepts,
//                    for the four fixture people (tests/sql/harness/fixtures.sql)
//                    and the barista the production suite adds.
//   /storage/v1/* -> the Storage calls the documents make (0053): a link to
//                    put one file, the file put through it, and a link to read
//                    it; the bucket's rules checked as the person, as Storage
//                    checks them, and the files kept in memory.
// It is not Supabase Auth and must never be deployed; it exists so the app's
// cookie sessions, row-level security and every database call can be exercised
// for real, with real JWTs, without a hosted project.
import http from "node:http";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error("JWT_SECRET is required");
const PORT = 54321;
const USERS = {
  "owner@example.com": "a0000000-0000-0000-0000-00000000000a",
  "manager@example.com": "a0000000-0000-0000-0000-00000000000b",
  "cashier@example.com": "a0000000-0000-0000-0000-00000000000c",
  "counter@example.com": "a0000000-0000-0000-0000-00000000000d",
  // Made by the production suite, which needs someone who makes the gelato.
  "barista@example.com": "a0000000-0000-0000-0000-00000000000e",
};
const PASSWORD = "password123";
// For the retry suite: the next call to this database function is carried out,
// and its answer is lost on the way back to the app's server — the connection
// is cut, as when the network drops between the server and the database.
let loseNextAnswer = null;

const b64u = (b) => Buffer.from(b).toString("base64url");
export function sign(payload) {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verify(token) {
  const [h, b, s] = String(token || "").split(".");
  if (!h || !b || !s) return null;
  const expect = crypto.createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url");
  if (expect !== s) return null;
  const p = JSON.parse(Buffer.from(b, "base64url").toString());
  if (p.exp && p.exp < Date.now() / 1000) return null;
  return p;
}
const refresh = new Map(); // refresh token -> email
function userObj(email) {
  return {
    id: USERS[email],
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    phone: "",
    confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    is_anonymous: false,
  };
}
function session(email) {
  const now = Math.floor(Date.now() / 1000);
  const rt = crypto.randomUUID();
  refresh.set(rt, email);
  return {
    access_token: sign({
      sub: USERS[email],
      email,
      role: "authenticated",
      aud: "authenticated",
      iat: now,
      exp: now + 3600,
      session_id: crypto.randomUUID(),
      aal: "aal1",
      is_anonymous: false,
      app_metadata: { provider: "email" },
      user_metadata: {},
    }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: rt,
    user: userObj(email),
  };
}
function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(obj === undefined ? "" : JSON.stringify(obj));
}
function body(req) {
  return new Promise((r) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => r(d));
  });
}
function bytes(req) {
  return new Promise((r) => {
    const parts = [];
    req.on("data", (c) => parts.push(c));
    req.on("end", () => r(Buffer.concat(parts)));
  });
}

// ------------------------------------------------------------------ Storage
// The files, by "<bucket>/<path>": what was put, and its kind.
const files = new Map();
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  "access-control-max-age": "600",
};
/**
 * SQL against the scratch database: as its superuser, as Storage writes a
 * file's row; or, given a person's claims, as that person, in a transaction
 * rolled back, as Storage checks what they may do.
 */
function storageSql(query, vars, claims = null) {
  const args = [
    "-X",
    "-q",
    "-At",
    "-v",
    "ON_ERROR_STOP=1",
    "-d",
    process.env.E2E_DB || "sixties_e2e",
  ];
  for (const [k, v] of Object.entries({ ...vars, claims: JSON.stringify(claims ?? {}) }))
    args.push("-v", `${k}=${v}`);
  const script = claims
    ? `begin;\nset local "request.jwt.claims" to :'claims';\nset local role authenticated;\n${query}\nrollback;\n`
    : `${query}\n`;
  return execFileSync("psql", args, { input: script, stdio: ["pipe", "pipe", "pipe"] })
    .toString()
    .trim();
}
function storageError(res, status, statusCode, error, message) {
  res.writeHead(status, { "content-type": "application/json", ...CORS });
  res.end(JSON.stringify({ statusCode, error, message }));
}
/** "/object/upload/sign/documents/a/b.pdf" -> { bucket: "documents", name: "a/b.pdf" }. */
function objectName(rest) {
  const [bucket, ...name] = rest.split("/").map(decodeURIComponent);
  return { bucket, name: name.join("/") };
}
async function storage(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...CORS,
      "access-control-allow-headers": req.headers["access-control-request-headers"] || "*",
    });
    return res.end();
  }
  const route = url.pathname.slice("/storage/v1".length);
  const token = verify(url.searchParams.get("token"));
  const person = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
  // A link to put one file there: given only to someone the bucket lets put it.
  if (req.method === "POST" && route.startsWith("/object/upload/sign/")) {
    const { bucket, name } = objectName(route.slice("/object/upload/sign/".length));
    if (!person?.sub) return storageError(res, 400, "403", "Unauthorized", "Invalid JWT");
    const vars = { bucket, name, sub: person.sub };
    const exists = storageSql(
      "select count(*) from storage.objects where bucket_id = :'bucket' and name = :'name';",
      vars,
    );
    if (exists !== "0")
      return storageError(res, 400, "409", "Duplicate", "The resource already exists");
    try {
      storageSql(
        "insert into storage.objects (bucket_id, name, owner, owner_id, metadata) " +
          "values (:'bucket', :'name', (:'sub')::uuid, :'sub', '{}'::jsonb) returning id;",
        vars,
        person,
      );
    } catch {
      return storageError(
        res,
        400,
        "403",
        "Unauthorized",
        "new row violates row-level security policy",
      );
    }
    const t = sign({
      owner: person.sub,
      url: `${bucket}/${name}`,
      upsert: false,
      exp: Math.floor(Date.now() / 1000) + 7200,
    });
    res.writeHead(200, { "content-type": "application/json", ...CORS });
    return res.end(JSON.stringify({ url: `/object/upload/sign/${bucket}/${name}?token=${t}` }));
  }
  // The file, put through that link: its kind and size checked against the bucket's.
  if (req.method === "PUT" && route.startsWith("/object/upload/sign/")) {
    const { bucket, name } = objectName(route.slice("/object/upload/sign/".length));
    if (!token || token.url !== `${bucket}/${name}`)
      return storageError(res, 400, "403", "Unauthorized", "Invalid signature");
    const data = await bytes(req);
    const type = String(req.headers["content-type"] || "")
      .split(";")[0]
      .trim();
    const [limit, types] = storageSql(
      "select coalesce(file_size_limit, 0) || '|' || coalesce(array_to_string(allowed_mime_types, ','), '') " +
        "from storage.buckets where id = :'bucket';",
      { bucket },
    ).split("|");
    if (types && !types.split(",").includes(type))
      return storageError(
        res,
        400,
        "415",
        "invalid_mime_type",
        `mime type ${type} is not supported`,
      );
    if (Number(limit) > 0 && data.length > Number(limit))
      return storageError(
        res,
        400,
        "413",
        "Payload too large",
        "The object exceeded the maximum allowed size",
      );
    const meta = {
      eTag: `"${crypto.createHash("md5").update(data).digest("hex")}"`,
      size: data.length,
      mimetype: type,
      cacheControl: String(req.headers["cache-control"] || "no-cache"),
      lastModified: new Date().toUTCString(),
      contentLength: data.length,
      httpStatusCode: 200,
    };
    let id;
    try {
      id = storageSql(
        "insert into storage.objects (bucket_id, name, owner, owner_id, metadata) " +
          "values (:'bucket', :'name', (:'owner')::uuid, :'owner', (:'meta')::jsonb) returning id;",
        { bucket, name, owner: token.owner, meta: JSON.stringify(meta) },
      );
    } catch {
      return storageError(res, 400, "409", "Duplicate", "The resource already exists");
    }
    files.set(`${bucket}/${name}`, { type, data });
    res.writeHead(200, { "content-type": "application/json", ...CORS });
    return res.end(JSON.stringify({ Key: `${bucket}/${name}`, Id: id }));
  }
  // A link to read a file for a minute: given only to someone who may read it.
  if (req.method === "POST" && route.startsWith("/object/sign/")) {
    const { bucket, name } = objectName(route.slice("/object/sign/".length));
    if (!person?.sub) return storageError(res, 400, "403", "Unauthorized", "Invalid JWT");
    const seen = storageSql(
      "select count(*) from storage.objects where bucket_id = :'bucket' and name = :'name';",
      { bucket, name },
      person,
    );
    if (seen !== "1") return storageError(res, 400, "404", "not_found", "Object not found");
    const { expiresIn = 60 } = JSON.parse((await body(req)) || "{}");
    const t = sign({
      url: `${bucket}/${name}`,
      exp: Math.floor(Date.now() / 1000) + Number(expiresIn),
    });
    res.writeHead(200, { "content-type": "application/json", ...CORS });
    return res.end(JSON.stringify({ signedURL: `/object/sign/${bucket}/${name}?token=${t}` }));
  }
  // The file itself, through that link, while it lasts.
  if (req.method === "GET" && route.startsWith("/object/sign/")) {
    const { bucket, name } = objectName(route.slice("/object/sign/".length));
    const file = files.get(`${bucket}/${name}`);
    if (!token || token.url !== `${bucket}/${name}`)
      return storageError(
        res,
        400,
        "InvalidSignature",
        "InvalidSignature",
        "The signature is invalid or expired",
      );
    if (!file) return storageError(res, 400, "404", "not_found", "Object not found");
    const download = url.searchParams.get("download");
    res.writeHead(200, {
      "content-type": file.type,
      "content-length": file.data.length,
      ...(download !== null
        ? {
            "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(download || name.split("/").pop())}`,
          }
        : {}),
      ...CORS,
    });
    return res.end(file.data);
  }
  return storageError(res, 400, "404", "not_found", `not handled: ${req.method} ${url.pathname}`);
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/__e2e/lose-next-answer" && req.method === "POST") {
      loseNextAnswer = url.searchParams.get("fn");
      return send(res, 204);
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const target = url.pathname.slice("/rest/v1".length) + url.search;
      const headers = { ...req.headers, host: "127.0.0.1:54330" };
      const lose =
        loseNextAnswer !== null &&
        req.method === "POST" &&
        url.pathname === `/rest/v1/rpc/${loseNextAnswer}`;
      if (lose) loseNextAnswer = null;
      const up = http.request(
        { host: "127.0.0.1", port: 54330, path: target, method: req.method, headers },
        (r) => {
          if (lose) {
            // The database has answered (and committed); the app never hears it.
            r.resume();
            r.on("end", () => req.socket.destroy());
            return;
          }
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        },
      );
      up.on("error", (e) => send(res, 502, { message: String(e) }));
      req.pipe(up);
      return;
    }
    if (url.pathname.startsWith("/storage/v1/")) return storage(req, res, url);
    if (url.pathname === "/auth/v1/token") {
      const data = JSON.parse((await body(req)) || "{}");
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        if (!USERS[data.email] || data.password !== PASSWORD)
          return send(res, 400, {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
            code: "invalid_credentials",
            msg: "Invalid login credentials",
          });
        return send(res, 200, session(data.email));
      }
      if (grant === "refresh_token") {
        const email = refresh.get(data.refresh_token);
        if (!email)
          return send(res, 400, {
            error: "invalid_grant",
            code: "refresh_token_not_found",
            msg: "Invalid Refresh Token",
          });
        return send(res, 200, session(email));
      }
      return send(res, 400, { msg: "unsupported grant" });
    }
    if (url.pathname === "/auth/v1/user") {
      const p = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
      if (!p || !p.email) return send(res, 401, { code: "bad_jwt", msg: "invalid JWT" });
      return send(res, 200, userObj(p.email));
    }
    if (url.pathname === "/auth/v1/logout") return send(res, 204);
    if (url.pathname === "/auth/v1/recover") return send(res, 200, {});
    if (url.pathname === "/auth/v1/signup")
      return send(res, 200, {
        id: crypto.randomUUID(),
        email: "x",
        confirmation_sent_at: new Date().toISOString(),
      });
    if (url.pathname.startsWith("/auth/v1/.well-known/jwks.json"))
      return send(res, 200, { keys: [] });
    send(res, 404, { msg: `not handled: ${url.pathname}` });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`gateway on ${PORT}`));

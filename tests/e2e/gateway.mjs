// A stand-in for Supabase's API gateway, for LOCAL end-to-end checks only:
//   /rest/v1/*  -> the real PostgREST (port 54330)
//   /auth/v1/*  -> a minimal auth server issuing HS256 JWTs PostgREST accepts,
//                  for the four fixture people (tests/sql/harness/fixtures.sql)
//                  and the barista the production suite adds.
// It is not Supabase Auth and must never be deployed; it exists so the app's
// cookie sessions, row-level security and every database call can be exercised
// for real, with real JWTs, without a hosted project.
import http from "node:http";
import crypto from "node:crypto";

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

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname.startsWith("/rest/v1/")) {
      const target = url.pathname.slice("/rest/v1".length) + url.search;
      const headers = { ...req.headers, host: "127.0.0.1:54330" };
      const up = http.request(
        { host: "127.0.0.1", port: 54330, path: target, method: req.method, headers },
        (r) => {
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        },
      );
      up.on("error", (e) => send(res, 502, { message: String(e) }));
      req.pipe(up);
      return;
    }
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

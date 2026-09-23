import crypto from "node:crypto";
const b64u = (b) => Buffer.from(b).toString("base64url");
const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const body = b64u(JSON.stringify({ role: "anon", iss: "supabase", iat: 1700000000, exp: 2000000000 }));
const sig = crypto.createHmac("sha256", process.env.JWT_SECRET).update(`${head}.${body}`).digest("base64url");
process.stdout.write(`${head}.${body}.${sig}`);

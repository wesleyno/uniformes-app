import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

const sessionPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function ensureSessionTable() {
  await sessionPool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);
}

ensureSessionTable().catch(console.error);

const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool: sessionPool,
      createTableIfMissing: false,
      tableName: "session",
      pruneSessionInterval: 60 * 15,
      errorLog: console.error.bind(console),
    }),
    secret: process.env.SESSION_SECRET || "nteamkit-secret-key-change-me",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    },
  })
);

app.set("trust proxy", 1);

// Initialize routes (async IIFE)
let initialized = false;
const initPromise = (async () => {
  await registerRoutes(httpServer, app);
  initialized = true;
})();

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Internal Server Error:", err);
  if (res.headersSent) {
    return _next(err);
  }
  return res.status(status).json({ message });
});

export default app;

import { appFromEnv } from "@/server/app";

// Tutta l'API passa da un handler Request -> Response indipendente da Next.
const app = appFromEnv(process.env);

export const GET = (request: Request) => app(request);
export const POST = (request: Request) => app(request);
export const PUT = (request: Request) => app(request);
export const PATCH = (request: Request) => app(request);
export const DELETE = (request: Request) => app(request);

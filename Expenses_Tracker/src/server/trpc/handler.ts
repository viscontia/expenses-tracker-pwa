import { defineEventHandler, toWebRequest } from "@tanstack/react-start/server";
import { fetchRequestHandler, type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { appRouter } from "./root";
import { verifyToken, type UserJWTPayload } from '~/server/utils/auth';

const createContext = ({ req }: FetchCreateContextFnOptions) => {
  const authHeader = req.headers.get('Authorization');
  let user: UserJWTPayload | null = null;
  const jwtSecret = process.env.JWT_SECRET!;

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        user = verifyToken(token, jwtSecret);
      } catch (error) {
        // Token is invalid or expired, user remains null
      }
    }
  }

  return { user, headers: req.headers };
};

export default defineEventHandler((event) => {
  const request = toWebRequest(event);
  if (!request) {
    return new Response("No request", { status: 400 });
  }

  return fetchRequestHandler({
    endpoint: "/trpc",
    req: request,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`tRPC error on '${path}':`, error);
    },
  });
});

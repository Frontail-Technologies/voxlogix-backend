import "express";

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: string;
      email?: string;
    }

    interface Request {
      user?: UserContext;
    }
  }
}

export {};

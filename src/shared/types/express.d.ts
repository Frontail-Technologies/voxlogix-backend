import "express";

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: string;
      email?: string;
      companyId?: string;
      requirePasswordReset?: boolean;
    }

    interface Request {
      user?: UserContext;
    }
  }
}

export {};

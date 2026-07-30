import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

type ValidationSchema = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

export function validate(schema: ValidationSchema) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (schema.body) {
      request.body = schema.body.parse(request.body);
    }

    if (schema.params) {
      request.params = schema.params.parse(request.params) as Request["params"];
    }

    if (schema.query) {
      const parsedQuery = schema.query.parse(request.query);
      Object.defineProperty(request, "query", {
        value: parsedQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  };
}

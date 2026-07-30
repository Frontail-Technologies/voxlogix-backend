import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import { env } from "@/config/env";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

const allowedAudioMimeTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
]);

const allowedDocumentMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new AppError({
          message: "Only JPG, PNG, WEBP, and SVG images are allowed.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          errorCode: ERROR_CODES.VALIDATION_ERROR,
        }),
      );
      return;
    }

    callback(null, true);
  },
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!allowedDocumentMimeTypes.has(file.mimetype)) {
      callback(
        new AppError({
          message: "Only PDF, TXT, DOC, and DOCX manual files are allowed.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          errorCode: ERROR_CODES.VALIDATION_ERROR,
        }),
      );
      return;
    }

    callback(null, true);
  },
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!allowedAudioMimeTypes.has(file.mimetype)) {
      callback(
        new AppError({
          message: "Only WEBM, OGG, MP3, MP4, and WAV audio files are allowed.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          errorCode: ERROR_CODES.VALIDATION_ERROR,
        }),
      );
      return;
    }

    callback(null, true);
  },
});

export const singleImageUploadMiddleware = upload.single("file");
export const singleDocumentUploadMiddleware = documentUpload.single("file");
export const singleAudioUploadMiddleware = audioUpload.single("file");
export const singleSpreadsheetUploadMiddleware = documentUpload.single("file");

export function ensureUploadedFile(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  if (!request.file) {
    next(
      new AppError({
        message: "No file was uploaded.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        errorCode: ERROR_CODES.VALIDATION_ERROR,
      }),
    );
    return;
  }

  next();
}

import type { Request, Response } from "express";

import {
  createSignedImageUpload,
  deleteImageAsset,
  uploadAudioAsset,
  uploadImageAsset,
} from "@/modules/uploads/uploads.service";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

export const postImageUpload = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await uploadImageAsset(request.file!, request.body);

    return sendSuccess(response, {
      statusCode: 201,
      message: "Image uploaded successfully",
      data: result,
    });
  },
);

export const postAudioUpload = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await uploadAudioAsset(request.file!, request.body);

    return sendSuccess(response, {
      statusCode: 201,
      message: "Audio uploaded successfully",
      data: result,
    });
  },
);

export const postSignedUpload = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await createSignedImageUpload(request.body);

    return sendSuccess(response, {
      statusCode: 201,
      message: "Signed upload created successfully",
      data: result,
    });
  },
);

export const removeUploadAsset = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await deleteImageAsset(request.body);

    return sendSuccess(response, {
      message: "Uploaded asset deleted successfully",
      data: result,
    });
  },
);

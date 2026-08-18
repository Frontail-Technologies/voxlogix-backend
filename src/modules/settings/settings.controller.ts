import type { Request, Response } from "express";

import {
  createAiProviderConfig,
  deleteAiProviderConfig,
  getGeneralSettingsDetail,
  listAiProviderConfigs,
  setAiProviderConfigDefault,
  updateAiProviderConfig,
  updateGeneralSettingsDetail,
} from "@/modules/settings/settings.service";
import { uploadImageAsset } from "@/modules/uploads/uploads.service";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";
import { ensureCompanyAccessSettings } from "@/shared/services/platform-defaults.service";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

export const getAiSettings = asyncHandler(
  async (_request: Request, response: Response) => {
    const result = await listAiProviderConfigs();

    return sendSuccess(response, {
      data: result,
    });
  },
);

export const postAiSettings = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await createAiProviderConfig(request.body);

    return sendSuccess(response, {
      statusCode: 201,
      message: "AI provider config created successfully",
      data: result,
    });
  },
);

export const patchAiSettings = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await updateAiProviderConfig(getParam(request.params.configId), request.body);

    return sendSuccess(response, {
      message: "AI provider config updated successfully",
      data: result,
    });
  },
);

export const patchAiSettingsDefault = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await setAiProviderConfigDefault(getParam(request.params.configId));

    return sendSuccess(response, {
      message: "Default AI provider updated successfully",
      data: result,
    });
  },
);

export const removeAiSettings = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await deleteAiProviderConfig(getParam(request.params.configId));

    return sendSuccess(response, {
      message: "AI provider config deleted successfully",
      data: result,
    });
  },
);

export const getGeneralSettings = asyncHandler(
  async (_request: Request, response: Response) => {
    const result = await getGeneralSettingsDetail();

    return sendSuccess(response, {
      data: result,
    });
  },
);

export const getCurrentCompanyAccessSettings = asyncHandler(
  async (request: Request, response: Response) => {
    const companyId = request.user?.companyId;
    const result = companyId ? await ensureCompanyAccessSettings(companyId) : null;

    return sendSuccess(response, {
      data: result,
    });
  },
);

export const patchGeneralSettings = asyncHandler(
  async (request: Request, response: Response) => {
    const logo = request.file
      ? await uploadImageAsset(request.file, {
          folder: "platform",
          context: "generic-image",
          fileName: "platform-logo",
        })
      : null;

    const result = await updateGeneralSettingsDetail({
      ...request.body,
      ...(logo ? { logoUrl: logo.secureUrl ?? logo.url, logoKey: logo.key } : {}),
    });

    return sendSuccess(response, {
      message: "General settings updated successfully",
      data: result,
    });
  },
);

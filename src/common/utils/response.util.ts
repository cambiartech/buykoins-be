export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

export class ResponseUtil {
  static success<T>(data?: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  static error(
    message: string,
    errors?: Array<{ field: string; message: string }>,
  ): ApiResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
}


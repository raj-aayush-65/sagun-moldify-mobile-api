import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponseDto } from '../dto/api-response.dto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let errorDetails: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle various NestJS exception response formats
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, any>;

        // Priority: message in response, else message from exception
        message = resp.message || exception.message;

        // If message is an array, join it
        if (Array.isArray(message)) {
          message = message.join(', ');
        }

        // Store additional error details if present
        if (resp.error) {
          errorDetails = resp.error;
        }
      }
    } else if (exception instanceof Error) {
      // Handle non-HTTP exceptions
      message = exception.message;
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    }

    // Create standardized error response
    const errorResponse = ApiResponseDto.error(message, errorDetails);

    response.status(status).json(errorResponse);
  }
}

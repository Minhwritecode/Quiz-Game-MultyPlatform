export type FailureCode = 'validation' | 'authentication' | 'conflict' | 'unavailable' | 'cancelled';
/** Only explicitly safe messages may cross into presentation. */
export class AppError extends Error {
  constructor(public readonly code: FailureCode, public readonly userMessage: string) {
    super(userMessage); this.name = 'AppError';
  }
}
export function errorMessage(error: unknown, fallback = 'Không thực hiện được thao tác. Hãy thử lại.'): string {
  return error instanceof AppError ? error.userMessage : fallback;
}
export function serviceFailure(status?: number): AppError {
 if(status===401 || status===403)return new AppError('authentication','Đăng nhập lại để tiếp tục.');
 if(status===409)return new AppError('conflict','Dữ liệu đã thay đổi. Hãy đồng bộ và thử lại.');
 if(status===429)return new AppError('unavailable','Đã hết lượt sử dụng. Hãy thử lại sau.');
 if(status===503)return new AppError('unavailable','Dịch vụ AI chưa sẵn sàng. Hãy thử lại sau.');
 return new AppError('unavailable','Không kết nối được dịch vụ. Kiểm tra mạng và thử lại.');
}

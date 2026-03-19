import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Can be plain password (for API testing) or encrypted JSON {encryptedData, salt}',
  })
  @IsString()
  @IsNotEmpty()
  // Skip MinLength check - encrypted passwords are much longer
  password: string;
}

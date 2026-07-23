import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateDocumentsLinkDto {
  @ApiProperty({
    description: 'Link exibido no botao Acessar documentos da barra lateral',
    example: 'https://drive.google.com/drive/folders/exemplo',
  })
  @IsString()
  @MaxLength(2000)
  url: string;
}

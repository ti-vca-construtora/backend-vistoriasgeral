import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubmitSatisfactionResponseDto } from './dto/submit-satisfaction-response.dto';
import { SatisfactionService } from './satisfaction.service';

@ApiTags('Public satisfaction')
@Controller('public/satisfaction')
export class PublicSatisfactionController {
  constructor(private readonly service: SatisfactionService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Carregar pesquisa publica pelo token' })
  @ApiResponse({ status: 200 })
  getSurvey(@Param('token') token: string) {
    return this.service.getPublicSurvey(token);
  }

  @Post(':token/responses')
  @ApiOperation({ summary: 'Responder pesquisa publica' })
  @ApiResponse({ status: 201 })
  submitResponse(
    @Param('token') token: string,
    @Body() dto: SubmitSatisfactionResponseDto,
  ) {
    return this.service.submitPublicSurvey(token, dto);
  }
}

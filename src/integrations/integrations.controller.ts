import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('google/oauth')
  async googleOAuth(@CurrentUser() user: any, @Body() body: any) {
    // TODO: Implement OAuth flow
    return {
      success: true,
      message: 'Google OAuth integration - TODO',
    };
  }

  @Post('google/sync')
  async googleSync(@CurrentUser() user: any) {
    // TODO: Implement calendar sync
    return {
      success: true,
      message: 'Google Calendar sync - TODO',
    };
  }
}


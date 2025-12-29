import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: any) {
    const userData = await this.usersService.findOne(user.userId);
    return {
      success: true,
      data: {
        id: userData.id,
        email: userData.email,
        lang: userData.lang,
        subscriptionTier: userData.subscriptionTier,
        settings: userData.settings,
      },
    };
  }

  @Put('settings')
  async updateSettings(
    @CurrentUser() user: any,
    @Body() body: { settings: any },
  ) {
    const updated = await this.usersService.updateSettings(
      user.userId,
      body.settings,
    );
    return {
      success: true,
      data: {
        settings: updated.settings,
      },
    };
  }
}


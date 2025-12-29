import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { GoalsService } from './goals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateGoalDto } from './dto/create-goal.dto';

@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.goalsService.findAll(user.userId);
  }

  @Get(':goalId')
  async findOne(
    @Param('goalId') goalId: string,
    @CurrentUser() user: any,
  ) {
    return this.goalsService.findOne(goalId, user.userId);
  }

  @Post()
  async create(
    @Body() createGoalDto: CreateGoalDto,
    @CurrentUser() user: any,
  ) {
    return this.goalsService.create(user.userId, createGoalDto);
  }

  @Delete(':goalId')
  async remove(
    @Param('goalId') goalId: string,
    @CurrentUser() user: any,
  ) {
    return this.goalsService.remove(goalId, user.userId);
  }
}


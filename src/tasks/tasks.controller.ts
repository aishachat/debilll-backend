import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('goals/:goalId/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async findAll(
    @Param('goalId') goalId: string,
    @Query('date') date: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.findAll(goalId, user.userId, date);
  }

  @Post()
  async create(
    @Param('goalId') goalId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.create(goalId, user.userId, body);
  }

  @Patch(':taskId')
  async update(
    @Param('taskId') taskId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.update(taskId, user.userId, body);
  }

  @Delete(':taskId')
  async remove(
    @Param('taskId') taskId: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.remove(taskId, user.userId);
  }

  @Post(':taskId/discuss')
  async discuss(
    @Param('taskId') taskId: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.discussTask(taskId, user.userId);
  }
}


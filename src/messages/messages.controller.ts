import { Controller, Get, Post, Param, Body, UseGuards, Res, Sse } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Response } from 'express';
import { Observable } from 'rxjs';

@Controller('goals/:goalId/chat')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('messages')
  async findAll(
    @Param('goalId') goalId: string,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.findAll(goalId, user.userId);
  }

  @Post('send')
  @Public() // Временно публичный endpoint для MVP
  async sendMessage(
    @Param('goalId') goalId: string,
    @Body() body: { 
      content: string; 
      taskId?: string; 
      stream?: boolean;
      taskTitle?: string;
      taskDescription?: string;
      userId?: string; // Добавляем userId в body
    },
    @Res() res?: Response,
  ) {
    // Используем переданный userId или дефолтный для обратной совместимости
    const userId = body.userId || 'default-user-id';
    console.log('[Controller] sendMessage - User ID:', userId || 'not provided');
    
    // Если запрошен streaming
    if (body.stream && res) {
      return this.messagesService.sendMessageStream(
        goalId,
        userId,
        body.content,
        body.taskId,
        res,
        body.taskTitle,
        body.taskDescription,
      );
    }
    
    // Обычный ответ
    try {
      const result = await this.messagesService.sendMessage(
        goalId,
        userId,
        body.content,
        body.taskId,
        body.taskTitle,
        body.taskDescription,
      );
      return res ? res.json(result) : result;
    } catch (error: any) {
      console.error('Error in sendMessage controller:', error);
      return res ? res.status(500).json({ 
        error: 'Internal server error',
        message: error?.message || 'Unknown error'
      }) : { error: error?.message || 'Unknown error' };
    }
  }
}


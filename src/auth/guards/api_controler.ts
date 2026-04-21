import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './guard';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApiController {
  constructor() {}
}

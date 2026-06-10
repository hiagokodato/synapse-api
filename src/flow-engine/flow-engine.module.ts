import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { FlowEngineService } from './flow-engine.service'

@Module({
  imports: [PrismaModule],
  providers: [FlowEngineService],
  exports: [FlowEngineService],
})
export class FlowEngineModule {}

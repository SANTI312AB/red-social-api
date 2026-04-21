import { Module, Global, Post } from '@nestjs/common';
import { ResponseService } from './response.service';
import { UserFormatterService } from './user-formatter.service';
import { PostFormatterService } from './post-formatter.service';

@Global() // <--- ¡Esta es la clave!
@Module({
  providers: [ResponseService, UserFormatterService,PostFormatterService],
  exports: [ResponseService,UserFormatterService,PostFormatterService],
})
export class InterfacesModule {}


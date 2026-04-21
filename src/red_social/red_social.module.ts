import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { CometariosService } from './comentarios.service';
import { CometariosController } from './comentarios.controller';
import { SeguidoresService } from './seguidores.service';
import { SeguidoresController } from './seguidores-controller';
import { PublicFunctionController } from './public-function.controller';
import { PublicFunctionService } from './public-function.service';
import { PostFormatterService } from 'src/Interfaces/post-formatter.service';



@Module({
  controllers: [PostController,CometariosController,SeguidoresController,PublicFunctionController],
  providers: [PostService,CometariosService,SeguidoresService,PublicFunctionService],
})
export class RedSocialModule {}

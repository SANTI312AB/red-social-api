import { HttpStatus, Injectable } from "@nestjs/common";
import { PostFormatterService } from "src/Interfaces/post-formatter.service";
import { ResponseService } from "src/Interfaces/response.service";
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FavoritosService{
    constructor(
        private prisma: PrismaService,
        private responseService: ResponseService,
        private postFormatter: PostFormatterService,
    ){}


   


    async guardad_post(userId: number, post_slug:string){
        
         const user = await this.prisma.login.findFirst({
            where: {
                IDLOGIN: userId,
                IDESTADO: 1,
                IDVERIFICACION: 7
            }
        });

        if (!user) {
            return this.responseService.error(
                'Usuario no encontrado.',
                HttpStatus.NOT_FOUND
            );
        }

        const post = await this.prisma.post.findUnique({
            where: {
                SLUG_POST: post_slug,
            }
        });

        if (!post) {
            return this.responseService.error(
                'Post no encontrado',
                HttpStatus.NOT_FOUND
            );
        }

        try {
            // Verificar si ya existe el favorito
            const favoritoExistente = await this.prisma.posts_guardados.findFirst({
                where: {
                    IDLOGIN: user.IDLOGIN,
                    ID_POST: post.ID_POST
                }
            });

        

            // ❌ YA EXISTE → se elimina
            if (favoritoExistente) {

                await this.prisma.posts_guardados.delete({
                    where: {ID_GUARDADO : favoritoExistente.ID_GUARDADO }
                });

                return this.responseService.success('Post eliminado de la lista de favoritos.');
            }

            // ✔ NO EXISTE → se agrega
            await this.prisma.posts_guardados.create({
                data: {
                    IDLOGIN: user.IDLOGIN,
                    ID_POST: post.ID_POST,
                    FECHA: new Date()
                }
            });

            const formattedPost = await this.postFormatter.fetchAndFormat(post.ID_POST);

            return this.responseService.success('Post añadido a la lista de guardados.',formattedPost);

        } catch (error) {
            return this.responseService.error(
                'Error al añadir el post a la lista de favoritos.',
                HttpStatus.INTERNAL_SERVER_ERROR,
                error
            );
        }

    }
}
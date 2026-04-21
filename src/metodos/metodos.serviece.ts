import { Injectable } from "@nestjs/common";
import { ResponseService } from "src/Interfaces/response.service";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class MetodosService {
    constructor(
        private prisma: PrismaService,
        private responseService: ResponseService,
    ) { }


    async metodo_login(){
        const data = await this.prisma.metodos_logeo.findMany({
            where:{
                HABILITADO_METODO_LOGEO: true        
            }
        });
        const formattedData= data.map((metodo) => ({
            nombre: metodo.NOMBRE_METODO_LOGEO,
            enable: metodo.HABILITADO_METODO_LOGEO,
            slug: metodo.SLUG
        }));
        return this.responseService.success("Métodos de login obtenidos correctamente", formattedData);
    }

}
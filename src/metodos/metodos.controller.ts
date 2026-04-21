import { Controller, Get } from "@nestjs/common";
import { MetodosService } from "./metodos.serviece";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags('Métodos(login)')
@Controller('metodos')
export class MetodosController{
    constructor(
        private  metodosService: MetodosService,
    ) { }

    @Get('logins')
    @ApiOperation({ summary: 'Obtiene los métodos de login disponibles' })
    async metodo_login(){
        return this.metodosService.metodo_login();
    }
} 
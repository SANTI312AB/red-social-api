import { Body, Controller, Get, Param, Patch, Query, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ApiController } from "src/auth/guards/api_controler";
import { notificacionQueryDto } from "./dto/notificacion-query.dto";
import { misNotificacionesService } from "./notificaciones.service";
import { notificacionDto } from "./dto/notificaciones.dto";
import { ParseHashIdPipe } from "src/utilis/pipes/parse-hash-id.pipe";

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('api')
export class  NotificacionesController extends ApiController{

    constructor(
        private notificaionService: misNotificacionesService
    ){
        super()
    }

    @Get('notificaciones')
    @ApiOperation({ summary: 'Actualizar lista de notificaciones.' })
    list(
        @Request() req,
        @Query() query: notificacionQueryDto
    ){
        const userId = req.user.IDLOGIN;
        return this.notificaionService.notificaciones(userId,query.estado,query.categoria, query.orden, query.notificacionId, query.page, query.limit );
    }

    @Patch('notificacion/:id')
    @ApiOperation({ summary: 'Actualizar notificacion por id.' })
    @ApiParam({name:'id', description:'Id de la notificacion a actualizar.', type:String})
    update(
        @Request() req,
        @Param('id', ParseHashIdPipe) id: any, // Valida que el ID sea número
        @Body() dto: notificacionDto
    ){
         const userId = req.user.IDLOGIN;
         return this.notificaionService.notificacionupdate(userId,id,dto);
    } 
}
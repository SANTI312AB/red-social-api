import { Controller, Post, Body, Request } from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { DispositivoDto } from './dto/dispositivo.dto';
import { ApiController } from 'src/auth/guards/api_controler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Dispositivo')
@ApiBearerAuth()
@Controller('api')
export class DispositivosController extends ApiController {
  constructor(private readonly dispositivosService: DispositivosService) {
    super()
  }


  @Post('registrar-dispositivo')
  @ApiOperation({summary:'Guardar información del dispositivo en el que se incio sessión.'})
  async registrar(
    @Request() req,
    @Body() dto: DispositivoDto 
  ) {
    const userId = req.user.IDLOGIN; 
    
    // 👇 3. Pasas los datos validados a tu servicio
    return await this.dispositivosService.registrarToken(userId, dto);
  }
}
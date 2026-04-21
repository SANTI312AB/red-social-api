import { Module } from "@nestjs/common";
import { DispositivosController } from "./dispositivo.controller";
import { DispositivosService } from "./dispositivos.service";

@Module({
    controllers:[DispositivosController],
    providers:[DispositivosService]
})
export class DispositivoModule{
    
}
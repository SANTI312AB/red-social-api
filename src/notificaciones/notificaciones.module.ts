import { Module } from "@nestjs/common";
import { NotificacionesController } from "./notificaciones.controller";
import { misNotificacionesService } from "./notificaciones.service";


@Module({
    controllers:[NotificacionesController],
    providers:[misNotificacionesService]
})
export class NotificacionesModule{}
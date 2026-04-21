import { Module } from "@nestjs/common";
import { MetodosController } from "./metodos.controller";
import { MetodosService } from "./metodos.serviece";

@Module({
    controllers: [MetodosController],
    providers: [MetodosService],
})
export class MetodosModule {}
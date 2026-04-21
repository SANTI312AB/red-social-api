import { Module } from "@nestjs/common";
import { InterfacesModule } from "src/Interfaces/interfaces.module";
import { FavoritosController } from "./favoritos.controller";
import { FavoritosService } from "./favoritos.service";

@Module({
      imports: [InterfacesModule], 
      controllers: [FavoritosController],
      providers: [FavoritosService],
})
export class FavoritosModule{}
import { Module, Global } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { IsUniqueConstraint } from './is-unique.validator';
import { IsExistingEntityConstraint } from './is-existing.validator';
import { IsTwoDecimalPlacesConstraint } from './is-two-decimal-places.validator';
import { UserValidatorService } from './user.validator.service';
import { ProfileValidator } from './profile.validator';
import { IsDniEcuadorConstraint } from './is-dni-ecuador.validator';
// CORREGIDO: Se importa la CLASE VALIDADORA, no la función decoradora.


@Global()
@Module({
  imports: [PrismaModule], // Se importa Prisma para que los validadores puedan inyectarlo.
  // CORREGIDO: Se proveen las CLASES VALIDADORAS, que son los servicios inyectables.
  providers: [IsUniqueConstraint, IsExistingEntityConstraint,IsTwoDecimalPlacesConstraint,UserValidatorService,ProfileValidator,IsDniEcuadorConstraint],
  exports: [IsUniqueConstraint, IsExistingEntityConstraint,IsTwoDecimalPlacesConstraint,UserValidatorService,ProfileValidator,IsDniEcuadorConstraint],
})
export class ValidatorsModule {}


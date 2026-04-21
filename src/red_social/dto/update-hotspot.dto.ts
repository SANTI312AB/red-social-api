import { PartialType } from '@nestjs/swagger';
import { CreateHotspotDto } from './create-hotspot.dto';

export class UpdateHotspotDto extends PartialType(CreateHotspotDto) {}

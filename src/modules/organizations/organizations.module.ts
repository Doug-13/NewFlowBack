import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { OrganizationsService }    from './organizations.service'
import { OrganizationsController } from './organizations.controller'
import {
  OrganizationArea,  OrganizationAreaSchema,
  OrganizationRole,  OrganizationRoleSchema,
  OrganizationGroup, OrganizationGroupSchema,
} from './schema/organization.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrganizationArea.name,  schema: OrganizationAreaSchema  },
      { name: OrganizationRole.name,  schema: OrganizationRoleSchema  },
      { name: OrganizationGroup.name, schema: OrganizationGroupSchema },
    ]),
  ],
  controllers: [OrganizationsController],
  providers:   [OrganizationsService],
  exports:     [OrganizationsService],
})
export class OrganizationsModule {}

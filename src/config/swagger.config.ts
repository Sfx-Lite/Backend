import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Swagger bootstrap
 * ─────────────────
 * Owns the OpenAPI document: global title/version/auth + where the UI mounts.
 * This is the SETUP half of API docs. The CONTENT half lives next to the code:
 * each route is described with @ApiTags / @ApiOperation / @ApiResponse in its
 * controller, and request bodies with @ApiProperty on their DTOs.
 * SwaggerModule.createDocument() scans the app and pulls those decorators in.
 *
 * Called from main.ts (dev only — never expose the schema in production).
 *
 * @returns the generated OpenAPI document, so the caller can optionally
 *          write it to disk (e.g. openapi.json) for frontend client codegen.
 */
export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('SFx Lite API')
    .setDescription('SFx Lite — Intern Build Program')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  return document;
}
